"""
Green-marker head gesture tracking.

A small green ball is mounted on the user's head with an elastic band. Its
position is tracked in HSV space and the *displacement from a calibrated rest
position* is interpreted as a command — left, right, up, down, or none.

Displacement from rest is used rather than absolute screen zones because the
camera is never in the same place twice, and a user's neutral head position
differs from session to session. Calibrating once at the start makes the
gesture thresholds mean the same thing for everyone.

This module has no Flask dependency so the detection logic can be tested
headlessly against synthetic frames.
"""

import sys
import threading
import time

import cv2
import numpy as np


def _capture_backends():
    """
    Capture backends to try, best first, for the current platform.

    CAP_ANY is always last so that an unusual setup still gets OpenCV's own
    default rather than no attempt at all.
    """
    if sys.platform == "win32":
        # DirectShow first: MSMF is OpenCV's default on Windows but often takes
        # several seconds to open a built-in webcam, or fails on it entirely.
        return [
            ("DirectShow", cv2.CAP_DSHOW),
            ("Media Foundation", cv2.CAP_MSMF),
            ("default", cv2.CAP_ANY),
        ]
    if sys.platform == "darwin":
        return [("AVFoundation", cv2.CAP_AVFOUNDATION), ("default", cv2.CAP_ANY)]
    return [("V4L2", cv2.CAP_V4L2), ("default", cv2.CAP_ANY)]


def _camera_error_message():
    """Platform-specific guidance for a camera that will not open."""
    if sys.platform == "win32":
        return (
            "Could not open the camera. Check Settings > Privacy & security > "
            "Camera, allow desktop apps to access it, and close any other app "
            "using the webcam (Teams, Zoom, the Camera app)."
        )
    if sys.platform == "darwin":
        return (
            "Could not open the camera. On macOS, grant camera access to your "
            "terminal in System Settings > Privacy & Security > Camera."
        )
    return (
        "Could not open the camera. Check that /dev/video0 exists and that your "
        "user is in the 'video' group."
    )

# Default HSV window for "green". Hue 40-90 covers yellow-green through cyan-
# green; the saturation and value floors reject grey and near-black pixels that
# would otherwise register as very dark green under poor lighting.
DEFAULT_LOWER_GREEN = (40, 80, 60)
DEFAULT_UPPER_GREEN = (90, 255, 255)

# Smallest blob accepted, as a fraction of frame area. Filters out speckle
# without rejecting a ball seen from across a room.
MIN_AREA_FRACTION = 0.0004

# How round a contour must be to count as the ball. A perfect circle scores
# 1.0; the upper bound allows for discretisation noise on small blobs.
MIN_CIRCULARITY = 0.6
MAX_CIRCULARITY = 1.3

# Dead zone around the rest position, as a *half*-extent fraction of frame
# width/height — the drawn box is twice these across. Below this the user is
# considered to be holding still.
#
# Bigger means a more deliberate head movement is needed to issue a command,
# which is calmer to drive but harder for someone with limited neck movement;
# smaller is twitchier and will pick up ordinary postural sway. There is no
# single right answer — it depends on the user's range of movement and how far
# they sit from the camera — so both are tunable at runtime via POST /settings.
DEAD_ZONE_X = 0.09
DEAD_ZONE_Y = 0.075

# Guard rails for runtime tuning. Below the floor the tracker would react to
# smoothing noise; above the ceiling opposite edges of the box approach the
# frame edge and some directions become unreachable.
MIN_DEAD_ZONE = 0.01
MAX_DEAD_ZONE = 0.35

# Consecutive agreeing frames before a new direction is committed. Prevents a
# single noisy frame from jerking the chair.
STABLE_FRAMES = 3

# Weight of each new observation in the position smoother. Lower is smoother
# but adds lag; this is a compromise that removes jitter without a perceptible
# delay at 30 fps.
SMOOTHING = 0.5

# Frames of stable detection required before auto-calibrating at startup.
AUTO_CALIBRATE_FRAMES = 15

# Marker must be missing this long before the direction falls back to "none".
LOST_MARKER_GRACE_SECONDS = 0.3


def detect_marker(frame_hsv, lower_green, upper_green, frame_area):
    """
    Locate the green ball in an HSV frame.

    Returns ((x, y), radius, mask) or (None, None, mask) if no acceptable blob
    is present. The largest qualifying contour wins — the original script
    dispatched a command for *every* qualifying contour, so with two green
    objects in shot the last one iterated silently decided the command.
    """
    mask = cv2.inRange(frame_hsv, np.array(lower_green), np.array(upper_green))

    # Opening removes speckle; closing fills the highlight that a glossy ball
    # shows under a bright lamp, which would otherwise split it into two blobs.
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = frame_area * MIN_AREA_FRACTION
    best = None
    best_area = 0.0

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area <= best_area:
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue

        circularity = 4 * np.pi * area / (perimeter ** 2)
        if not (MIN_CIRCULARITY < circularity < MAX_CIRCULARITY):
            continue

        (x, y), radius = cv2.minEnclosingCircle(contour)
        best = ((float(x), float(y)), float(radius))
        best_area = area

    if best is None:
        return None, None, mask
    return best[0], best[1], mask


def classify(dx, dy, width, height, dead_zone_x=DEAD_ZONE_X, dead_zone_y=DEAD_ZONE_Y):
    """
    Turn a displacement from rest into a command.

    Only one direction is ever returned. The wheelchair model treats speed as
    persistent — up/down change it, left/right steer without altering it — so a
    single command per frame is sufficient and matches how the frontend and the
    original detector both behave.

    The dominant axis wins, measured relative to each axis's own dead zone, so
    a mostly-sideways tilt does not register as "up" just because the vertical
    threshold happens to be smaller.

    The dead zones default to the module constants so existing callers and
    tests keep working, but the tracker passes its own tunable values.
    """
    zone_x = width * dead_zone_x
    zone_y = height * dead_zone_y

    over_x = abs(dx) / zone_x if zone_x > 0 else 0.0
    over_y = abs(dy) / zone_y if zone_y > 0 else 0.0

    if over_x < 1.0 and over_y < 1.0:
        return "none"

    if over_x >= over_y:
        return "right" if dx > 0 else "left"
    return "down" if dy > 0 else "up"


class MarkerTracker:
    """
    Owns the camera and derives a gesture command from each frame.

    A single instance runs on a background thread so that the camera is opened
    exactly once. The previous implementation opened a capture inside the
    video-stream request handler, so a second viewer — or a page refresh —
    fought the first for the device, and no direction was produced at all when
    nobody was watching the stream.
    """

    def __init__(self, camera_index=0, mirror=True):
        self.camera_index = camera_index
        # Mirroring makes the preview behave like a mirror, so moving your head
        # to your right moves the marker right on screen. Without it left and
        # right are inverted, which for a training tool is worse than useless.
        self.mirror = mirror

        self.lower_green = list(DEFAULT_LOWER_GREEN)
        self.upper_green = list(DEFAULT_UPPER_GREEN)

        self.dead_zone_x = DEAD_ZONE_X
        self.dead_zone_y = DEAD_ZONE_Y

        self.direction = "none"
        self.detected = False
        self.calibrated = False
        self.rest = None          # (x, y) rest position of the marker
        self.position = None      # smoothed current position
        self.radius = 0.0
        self.frame_size = (0, 0)  # (width, height)
        self.camera_ok = False
        self.error = None

        self._candidate = "none"
        self._candidate_count = 0
        self._stable_detections = 0
        self._last_seen = 0.0
        self._jpeg = None
        self._capture = None
        # An Event rather than a bool so that stop() called before the capture
        # thread is first scheduled still stops it: a bool set to True at the
        # top of run() would clobber the stop and loop forever.
        self._stop_event = threading.Event()
        self._thread = None
        self._release_lock = threading.Lock()

    # -- calibration -------------------------------------------------------

    def calibrate(self):
        """Adopt the current marker position as the neutral rest position."""
        if self.position is None:
            return False
        self.rest = tuple(self.position)
        self.calibrated = True
        self._candidate = "none"
        self._candidate_count = 0
        self.direction = "none"
        return True

    def set_hsv_range(self, lower, upper):
        self.lower_green = [int(v) for v in lower]
        self.upper_green = [int(v) for v in upper]

    def set_dead_zone(self, dead_zone_x, dead_zone_y):
        """
        Resize the neutral zone, as half-extent fractions of the frame.

        Clamped rather than rejected: this is a live tuning knob turned while
        someone is sitting in front of the camera, and silently holding the
        nearest usable value beats dropping them into a state where no gesture
        registers at all.
        """
        self.dead_zone_x = min(MAX_DEAD_ZONE, max(MIN_DEAD_ZONE, float(dead_zone_x)))
        self.dead_zone_y = min(MAX_DEAD_ZONE, max(MIN_DEAD_ZONE, float(dead_zone_y)))

        # The old command was derived against the previous zone, so drop it and
        # re-derive rather than leaving the chair driving on a stale decision.
        self._candidate = "none"
        self._candidate_count = 0
        self.direction = "none"

    # -- per-frame processing ---------------------------------------------

    def process(self, frame):
        """
        Process one BGR frame and update state. Returns the annotated frame.

        Separated from the capture loop so tests can drive it with synthetic
        frames and no camera.
        """
        if self.mirror:
            frame = cv2.flip(frame, 1)
        else:
            # flip() already returns a new array; without it the annotations
            # below would be drawn into the caller's frame. The capture loop
            # never reuses a frame so this only shows up in tests, which is
            # precisely the case this module is meant to support.
            frame = frame.copy()

        height, width = frame.shape[:2]
        self.frame_size = (width, height)

        frame_hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        position, radius, mask = detect_marker(
            frame_hsv, self.lower_green, self.upper_green, width * height
        )

        now = time.monotonic()

        if position is None:
            self.detected = False
            self._stable_detections = 0
            # Only give up on the marker after a short grace period: a single
            # dropped frame while the user turns should not stop the chair.
            if now - self._last_seen > LOST_MARKER_GRACE_SECONDS:
                self.direction = "none"
                self._candidate = "none"
                self._candidate_count = 0
        else:
            self.detected = True
            self._last_seen = now
            self.radius = radius

            if self.position is None:
                self.position = list(position)
            else:
                # Exponential smoothing on the marker centre.
                self.position[0] += SMOOTHING * (position[0] - self.position[0])
                self.position[1] += SMOOTHING * (position[1] - self.position[1])

            self._stable_detections += 1
            if not self.calibrated and self._stable_detections >= AUTO_CALIBRATE_FRAMES:
                self.calibrate()

            if self.calibrated:
                dx = self.position[0] - self.rest[0]
                dy = self.position[1] - self.rest[1]
                observed = classify(
                    dx, dy, width, height, self.dead_zone_x, self.dead_zone_y
                )

                # Require several agreeing frames before committing, so noise
                # around a threshold cannot oscillate the command.
                if observed == self._candidate:
                    self._candidate_count += 1
                else:
                    self._candidate = observed
                    self._candidate_count = 1

                if self._candidate_count >= STABLE_FRAMES:
                    self.direction = self._candidate

        return self._annotate(frame, mask)

    # -- overlay -----------------------------------------------------------

    def _annotate(self, frame, mask):
        height, width = frame.shape[:2]

        if self.calibrated and self.rest is not None:
            rest = (int(self.rest[0]), int(self.rest[1]))
            zone_x = int(width * self.dead_zone_x)
            zone_y = int(height * self.dead_zone_y)

            # Dead zone: inside this rectangle the user is holding still.
            cv2.rectangle(
                frame,
                (rest[0] - zone_x, rest[1] - zone_y),
                (rest[0] + zone_x, rest[1] + zone_y),
                (0, 255, 255),
                2,
            )
            cv2.drawMarker(frame, rest, (0, 255, 255), cv2.MARKER_CROSS, 14, 2)

            # Direction labels around the dead zone.
            for label, point in (
                ("LEFT", (rest[0] - zone_x - 60, rest[1] + 5)),
                ("RIGHT", (rest[0] + zone_x + 10, rest[1] + 5)),
                ("UP", (rest[0] - 12, rest[1] - zone_y - 12)),
                ("DOWN", (rest[0] - 20, rest[1] + zone_y + 26)),
            ):
                active = self.direction == label.lower()
                cv2.putText(
                    frame, label, point, cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                    (0, 255, 0) if active else (140, 140, 140), 2,
                )

            if self.position is not None:
                cv2.line(
                    frame, rest,
                    (int(self.position[0]), int(self.position[1])),
                    (255, 128, 0), 2,
                )

        if self.detected and self.position is not None:
            centre = (int(self.position[0]), int(self.position[1]))
            cv2.circle(frame, centre, max(4, int(self.radius)), (0, 0, 255), 2)
            cv2.circle(frame, centre, 3, (0, 0, 255), -1)

        # Status banner.
        if not self.detected:
            banner, colour = "No green marker detected", (0, 0, 255)
        elif not self.calibrated:
            banner, colour = "Hold still - calibrating...", (0, 200, 255)
        else:
            banner, colour = f"Direction: {self.direction}", (0, 255, 0)

        cv2.putText(frame, banner, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, colour, 2)

        # A small mask inset makes bad lighting or a wrong HSV range obvious at
        # a glance, which is the usual reason green tracking fails.
        inset_w, inset_h = width // 5, height // 5
        inset = cv2.resize(mask, (inset_w, inset_h))
        frame[height - inset_h:, width - inset_w:] = cv2.cvtColor(inset, cv2.COLOR_GRAY2BGR)
        cv2.rectangle(
            frame, (width - inset_w, height - inset_h), (width - 1, height - 1),
            (200, 200, 200), 1,
        )

        return frame

    # -- capture loop ------------------------------------------------------

    def open_camera(self):
        """
        Open the capture device. Returns True on success.

        This must be called from the *main* thread on macOS. AVFoundation
        raises its permission prompt on the main run loop, and OpenCV refuses
        to request authorization from a worker thread ("can not spin main run
        loop from other thread"), so opening the camera inside the capture
        thread makes the first run fail even when the user would have granted
        access.

        Backends are tried in platform-appropriate order because OpenCV's
        default choice is not reliable everywhere — most notably on Windows,
        where MSMF is the default but frequently stalls for several seconds or
        fails outright on built-in webcams.
        """
        for name, backend in _capture_backends():
            capture = cv2.VideoCapture(self.camera_index, backend)

            # isOpened() alone is not enough: some backends report success and
            # then fail on the first read.
            if capture.isOpened():
                ok, _ = capture.read()
                if ok:
                    self._capture = capture
                    self.camera_ok = True
                    self.error = None
                    print(f"Camera opened via {name}. Tracking green marker.")
                    return True
            capture.release()

        self.camera_ok = False
        self.error = _camera_error_message()
        print(f"Error: {self.error}")
        self._jpeg = self._placeholder_jpeg("No camera available")
        self._capture = None
        return False

    def start(self):
        """
        Run the capture loop on a background thread. Returns True if it started.

        The camera must already be open — see open_camera() for why that has to
        happen on the main thread. The thread is a daemon so that a hard exit
        can never hang on it, but stop() joins it explicitly, because on the
        ordinary shutdown path we want the device released deliberately rather
        than left for the kernel to reclaim.
        """
        if self._capture is None or self._thread is not None:
            return False

        self._thread = threading.Thread(
            target=self.run, daemon=True, name="marker-capture"
        )
        self._thread.start()
        return True

    def run(self):
        """Capture loop. Safe to run on a background thread once the camera is open."""
        if self._capture is None:
            return

        try:
            while not self._stop_event.is_set():
                ok, frame = self._capture.read()
                if not ok:
                    time.sleep(0.05)
                    continue

                annotated = self.process(frame)
                ok, buffer = cv2.imencode(".jpg", annotated)
                if ok:
                    self._jpeg = buffer.tobytes()
        finally:
            self._release()

    def stop(self, timeout=2.0):
        """
        Stop tracking and release the camera.

        Idempotent, and safe to call from a signal handler or a watchdog
        thread — which is the point: this is what turns the camera light off
        when the process is told to go away.

        The capture thread is joined first so the device is released by the
        thread that owns it. If it is still inside a blocking read() when the
        timeout expires, the release is deliberately *not* forced: tearing a
        capture down underneath an in-flight read crashes the AVFoundation and
        MSMF backends, and process exit closes the handle anyway.
        """
        self._stop_event.set()

        thread = self._thread
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout)
            if thread.is_alive():
                return False

        self._thread = None
        self._release()
        return True

    def _release(self):
        """Release the capture device. Safe from any thread, any number of times."""
        with self._release_lock:
            capture = self._capture
            self._capture = None

        if capture is not None:
            capture.release()
            self.camera_ok = False

    def latest_jpeg(self):
        return self._jpeg

    @staticmethod
    def _placeholder_jpeg(message):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(
            frame, message, (60, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2
        )
        ok, buffer = cv2.imencode(".jpg", frame)
        return buffer.tobytes() if ok else b""
