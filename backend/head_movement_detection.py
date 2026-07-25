"""
Gesture detection server for the wheelchair training simulator.

Tracks a green marker mounted on the user's head and exposes the resulting
command over HTTP for the frontend to consume.

    python3 backend/head_movement_detection.py

Run it from the repository root. Endpoints:

    GET  /video_feed      annotated MJPEG stream
    GET  /head_direction  {"direction": "left"|"right"|"up"|"down"|"none", ...}
    POST /calibrate       adopt the marker's current position as neutral
    GET  /status          camera, detection and calibration state
    POST /settings        adjust the HSV window for the marker colour
"""

import atexit
import os
import signal
import sys
import threading
import time

from flask import Flask, Response, jsonify, request
from flask_cors import CORS

from marker_tracking import (
    DEAD_ZONE_X,
    DEAD_ZONE_Y,
    DEFAULT_LOWER_GREEN,
    DEFAULT_UPPER_GREEN,
    MarkerTracker,
)

app = Flask(__name__)
CORS(app)

tracker = MarkerTracker(camera_index=0, mirror=True)

# Seconds without a single client request before the server gives the camera
# back. 0 disables it. This is the backstop that makes the camera light follow
# the *app* rather than the terminal: whatever happens to the process that
# launched us, nothing is looking at the video once the frontend is closed.
IDLE_TIMEOUT = float(os.environ.get("IDLE_TIMEOUT", "120"))

_last_client_activity = time.monotonic()
_activity_lock = threading.Lock()


def note_client_activity():
    global _last_client_activity
    with _activity_lock:
        _last_client_activity = time.monotonic()


def seconds_since_client_activity():
    with _activity_lock:
        return time.monotonic() - _last_client_activity


@app.before_request
def _record_client_activity():
    note_client_activity()


def frame_stream():
    """
    Yield the most recent annotated frame as MJPEG.

    Frames come from the tracker's capture thread rather than being grabbed
    here, so any number of viewers can watch without competing for the camera.
    """
    while True:
        jpeg = tracker.latest_jpeg()
        if jpeg is not None:
            # A stream is one long-lived request, so before_request fires only
            # at its start. Without this the idle watchdog would shut down a
            # server that is actively streaming video to a watching browser.
            note_client_activity()
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n")
        # Roughly 30 fps; the capture thread sets the real rate.
        time.sleep(1 / 30)


@app.route("/video_feed")
def video_feed():
    return Response(
        frame_stream(), mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/head_direction")
def head_direction():
    """
    Current command.

    `direction` is the field the frontend drives the chair from; the rest is
    diagnostic, so the UI can distinguish "you are holding still" from "the
    marker is not visible", which look identical if you only read `direction`.
    """
    return jsonify({
        "direction": tracker.direction,
        "detected": tracker.detected,
        "calibrated": tracker.calibrated,
        "cameraOk": tracker.camera_ok,
    })


@app.route("/calibrate", methods=["POST"])
def calibrate():
    if tracker.calibrate():
        return jsonify({"ok": True, "rest": tracker.rest})
    return jsonify({
        "ok": False,
        "error": "No marker visible to calibrate against.",
    }), 409


@app.route("/status")
def status():
    return jsonify({
        "cameraOk": tracker.camera_ok,
        "error": tracker.error,
        "detected": tracker.detected,
        "calibrated": tracker.calibrated,
        "direction": tracker.direction,
        "rest": tracker.rest,
        "position": tracker.position,
        "frameSize": tracker.frame_size,
        "hsv": {"lower": tracker.lower_green, "upper": tracker.upper_green},
        "deadZone": {"x": tracker.dead_zone_x, "y": tracker.dead_zone_y},
    })


@app.route("/settings", methods=["POST"])
def settings():
    """
    Retune the marker colour window and the size of the neutral zone.

    Both are things that only reveal themselves on site: green detection
    depends entirely on the room's lighting, and the right dead zone depends on
    how much neck movement the user has and how far they sit from the camera.
    Each field is optional, so either can be adjusted without disturbing the
    other.
    """
    data = request.get_json(silent=True) or {}
    lower = data.get("lower", tracker.lower_green)
    upper = data.get("upper", tracker.upper_green)
    dead_zone = data.get("deadZone")

    try:
        if len(lower) != 3 or len(upper) != 3:
            raise ValueError("lower and upper must each have 3 values")
        tracker.set_hsv_range(lower, upper)

        if dead_zone is not None:
            tracker.set_dead_zone(
                dead_zone.get("x", tracker.dead_zone_x),
                dead_zone.get("y", tracker.dead_zone_y),
            )
    except (AttributeError, TypeError, ValueError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    return jsonify({
        "ok": True,
        "hsv": {"lower": tracker.lower_green, "upper": tracker.upper_green},
        "deadZone": {"x": tracker.dead_zone_x, "y": tracker.dead_zone_y},
    })


@app.route("/")
def index():
    return f"""
    <html>
    <head>
        <title>Green Marker Tracking</title>
        <style>
            body {{ font-family: system-ui, sans-serif; text-align: center;
                   margin-top: 40px; background: #0f172a; color: #e2e8f0; }}
            img {{ max-width: 100%; border-radius: 6px; }}
            button {{ font-size: 15px; padding: 8px 18px; border-radius: 6px;
                     border: 0; background: #2563eb; color: white;
                     cursor: pointer; }}
            .state {{ margin: 14px 0; font-size: 18px; }}
            .hint {{ color: #94a3b8; font-size: 14px; max-width: 640px;
                    margin: 14px auto; }}
        </style>
    </head>
    <body>
        <h1>Green Marker Tracking</h1>
        <div class="state">
            Direction: <b id="direction">…</b> &nbsp;|&nbsp;
            <span id="state"></span>
        </div>
        <img src="/video_feed" alt="Annotated video" width="640" height="480" />
        <p><button onclick="recalibrate()">Recalibrate (centre the marker first)</button></p>
        <p class="hint">
            The yellow box is the dead zone around your neutral head position.
            Move the marker past its edge to steer. If it feels twitchy make the
            box bigger; if steering is hard work make it smaller &mdash;
            POST /settings with
            <code>{{"deadZone": {{"x": 0.12, "y": 0.10}}}}</code> (fractions of
            the frame, currently {DEAD_ZONE_X} / {DEAD_ZONE_Y}).
            The inset in the corner shows what the colour filter sees &mdash; if
            the ball is not a solid white blob there, the lighting or the HSV
            range needs adjusting, also via POST /settings (defaults:
            lower {list(DEFAULT_LOWER_GREEN)}, upper {list(DEFAULT_UPPER_GREEN)}).
        </p>
        <script>
            async function recalibrate() {{
                const r = await fetch('/calibrate', {{ method: 'POST' }});
                const d = await r.json();
                if (!d.ok) alert(d.error);
            }}
            setInterval(async () => {{
                const d = await (await fetch('/head_direction')).json();
                document.getElementById('direction').textContent = d.direction;
                document.getElementById('state').textContent =
                    !d.cameraOk ? 'no camera'
                    : !d.detected ? 'marker not visible'
                    : !d.calibrated ? 'calibrating…'
                    : 'tracking';
            }}, 200);
        </script>
    </body>
    </html>
    """


def shutdown(reason):
    """
    Release the camera and exit.

    Called from signal handlers and from the orphan watchdog thread, so it must
    not assume it is running on the main thread. Flask's development server has
    no clean programmatic shutdown from a signal handler, and the only resource
    that outlives this process in a way anyone notices is the camera, so once
    that is released we exit without unwinding.
    """
    print(f"\nShutting down ({reason}). Releasing the camera.", flush=True)
    tracker.stop()
    os._exit(0)


def install_signal_handlers():
    """
    Turn the camera off on every signal that means "go away".

    SIGHUP is the one this is really for: a shell sends it to its foreground
    jobs when its terminal window closes. Python's default action is to die
    immediately, which does free the device — but only as a side effect of the
    kernel reaping the file descriptor, after the capture loop has been shot
    mid-frame. Handling it means the release is ours and ordered.
    """
    for name in ("SIGINT", "SIGTERM", "SIGHUP"):
        sig = getattr(signal, name, None)
        if sig is not None:  # SIGHUP does not exist on Windows.
            signal.signal(sig, lambda _signum, _frame, n=name: shutdown(n))


# Captured at import, before anything slow: opening the camera takes a second
# or two, and a launcher that exits during that window would otherwise be
# indistinguishable from having been started by init, disabling the watchdog
# below in precisely the case it exists to catch.
LAUNCHING_PARENT = os.getppid()


def watch_for_orphaning(poll_seconds=2.0):
    """
    Exit when whatever launched this server goes away.

    Signals alone are not enough. A backend started in the background —
    `python backend/head_movement_detection.py &`, `nohup`, or from an editor
    or agent that detaches it — is not in the shell's foreground process group,
    so closing the terminal never sends it SIGHUP. It is silently reparented to
    init and keeps the camera light on with nobody left watching it. That is
    exactly the state this project was found in: a server orphaned to PID 1,
    still streaming, long after its terminal was gone.

    Polling getppid() catches that regardless of how the process was started.

    Skipped when we are *already* a child of init at startup, since that is the
    normal state under launchd/systemd, where outliving the launcher is the
    entire point.

    POSIX only. Windows has no reparenting — getppid() there keeps returning a
    parent id that may since have been reused — but it also terminates every
    process attached to a console when that console window is closed, so the
    case this guards against does not arise.
    """
    if sys.platform == "win32":
        return None

    if LAUNCHING_PARENT == 1:
        return None

    def watch():
        while True:
            time.sleep(poll_seconds)
            if os.getppid() != LAUNCHING_PARENT:
                shutdown("the process that started this server exited")

    thread = threading.Thread(target=watch, daemon=True, name="orphan-watchdog")
    thread.start()
    return thread


def watch_for_idleness(timeout_seconds, poll_seconds=5.0):
    """
    Give the camera back once no client has asked for anything in a while.

    The signal handlers and the orphan watchdog both key off *how this process
    was launched*, and neither is airtight: a launcher that spawns the server
    detached and exits immediately leaves no parent to notice dying and no
    controlling terminal to send SIGHUP. (Watching the terminal directly was
    tried and rejected — reading the tty from a background job raises SIGTTIN
    and suspends the server.)

    Client traffic sidesteps all of that. If the simulator is open it polls
    /head_direction continuously; if it is closed, nothing does, and there is
    no reason to hold the device. This is the only mechanism here that is
    launch-method- and platform-independent, so it is the real safety net.
    """
    if timeout_seconds <= 0:
        return None

    def watch():
        while True:
            time.sleep(poll_seconds)
            idle = seconds_since_client_activity()
            if idle >= timeout_seconds:
                shutdown(f"no client for {int(idle)}s")

    thread = threading.Thread(target=watch, daemon=True, name="idle-watchdog")
    thread.start()
    return thread


if __name__ == "__main__":
    # Not port 5000: on macOS the AirPlay Receiver binds it and answers every
    # request with 403, which looks exactly like a broken backend.
    # Override with PORT=... if 5001 is taken too.
    port = int(os.environ.get("PORT", "5001"))

    print("Starting green marker tracking server...")
    print(f"  Overview:    http://localhost:{port}/")
    print(f"  Video feed:  http://localhost:{port}/video_feed")
    print(f"  Direction:   http://localhost:{port}/head_direction")

    # Open the camera here, on the main thread: macOS will not raise its
    # permission prompt from a worker thread. Only the read loop is threaded.
    if tracker.open_camera():
        tracker.start()
    else:
        print("Continuing without a camera; the video feed will show a placeholder.")

    # Every route out of this process releases the camera: a signal, the
    # launching process disappearing, nobody using the server, or an ordinary
    # return from app.run().
    install_signal_handlers()
    watch_for_orphaning()
    watch_for_idleness(IDLE_TIMEOUT)
    atexit.register(tracker.stop)

    if IDLE_TIMEOUT > 0:
        print(f"  Camera is released after {IDLE_TIMEOUT:g}s with no client "
              f"(set IDLE_TIMEOUT=0 to disable).")

    try:
        # The reloader would spawn a second process, and with it a second
        # camera handle, so it stays off.
        app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
    finally:
        tracker.stop()
