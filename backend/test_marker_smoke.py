"""
Headless smoke tests for the green-marker tracker.

Drives MarkerTracker.process() with synthetic frames, so no camera and no
Flask server are involved. Run from anywhere:

    .venv/bin/python backend/test_marker_smoke.py

Thresholds referenced here are the module constants in marker_tracking.py;
if those are retuned, the expectations below need to move with them.
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cv2
import numpy as np

from marker_tracking import (
    AUTO_CALIBRATE_FRAMES,
    DEAD_ZONE_X,
    LOST_MARKER_GRACE_SECONDS,
    STABLE_FRAMES,
    MarkerTracker,
    classify,
)

WIDTH, HEIGHT = 640, 480
CX, CY = WIDTH // 2, HEIGHT // 2

checks = 0
failures = []


def check(condition, label):
    global checks
    checks += 1
    if not condition:
        failures.append(label)
    print(f"  {'ok  ' if condition else 'FAIL'}  {label}")


def green_frame(x, y, radius=20):
    """A black frame with one filled green circle at (x, y)."""
    frame = np.zeros((HEIGHT, WIDTH, 3), np.uint8)
    cv2.circle(frame, (int(x), int(y)), radius, (0, 255, 0), -1)
    return frame


def blank_frame():
    return np.zeros((HEIGHT, WIDTH, 3), np.uint8)


def feed(tracker, frame, count):
    # A fresh copy each time: process() returns an annotated frame, and feeding
    # an already-annotated one back in would compound the overlay.
    for _ in range(count):
        tracker.process(frame.copy())


def calibrated_tracker(mirror=True):
    """A tracker that has auto-calibrated with the marker at frame centre."""
    tracker = MarkerTracker(mirror=mirror)
    feed(tracker, green_frame(CX, CY), AUTO_CALIBRATE_FRAMES + 5)
    return tracker


# -- calibration ------------------------------------------------------------

print("\ncalibration")

t = MarkerTracker()
feed(t, green_frame(CX, CY), AUTO_CALIBRATE_FRAMES - 1)
check(not t.calibrated, f"not calibrated before {AUTO_CALIBRATE_FRAMES} stable frames")

t.process(green_frame(CX, CY))
check(t.calibrated, f"auto-calibrates at {AUTO_CALIBRATE_FRAMES} stable frames")
check(t.direction == "none", "neutral at the rest position")

# Manual recalibration adopts wherever the marker currently is.
t = calibrated_tracker()
feed(t, green_frame(CX + 100, CY), 5)
check(t.calibrate(), "manual calibrate succeeds while the marker is visible")
check(t.direction == "none", "recalibrating resets the command to none")
feed(t, green_frame(CX + 100, CY), 5)
check(t.direction == "none", "the new rest position reads as neutral")

t = MarkerTracker()
feed(t, blank_frame(), 5)
check(not t.calibrate(), "manual calibrate refuses with no marker visible")


# -- the four gestures, and the mirroring sense -----------------------------
#
# Frames are mirrored, so a marker drawn on the LEFT of the raw frame is what a
# webcam sees when the user turns their head to their own RIGHT.

print("\ngestures (mirrored, as the webcam sees them)")

for raw_x, raw_y, expected in (
    (CX - 120, CY, "right"),
    (CX + 120, CY, "left"),
    (CX, CY - 120, "up"),
    (CX, CY + 120, "down"),
):
    t = calibrated_tracker()
    feed(t, green_frame(raw_x, raw_y), STABLE_FRAMES + 3)
    check(t.direction == expected, f"raw offset ({raw_x - CX:+d}, {raw_y - CY:+d}) -> {expected}")

# With mirroring off the horizontal sense inverts and the vertical does not.
t = calibrated_tracker(mirror=False)
feed(t, green_frame(CX - 120, CY), STABLE_FRAMES + 3)
check(t.direction == "left", "mirror=False inverts left/right")

t = calibrated_tracker(mirror=False)
feed(t, green_frame(CX, CY - 120), STABLE_FRAMES + 3)
check(t.direction == "up", "mirror=False leaves up/down alone")


# -- dead zone --------------------------------------------------------------

print("\ndead zone")

inside = int(WIDTH * DEAD_ZONE_X) - 10
outside = int(WIDTH * DEAD_ZONE_X) + 25

t = calibrated_tracker()
feed(t, green_frame(CX - inside, CY), STABLE_FRAMES + 3)
check(t.direction == "none", f"{inside} px is inside the {int(WIDTH * DEAD_ZONE_X)} px dead zone")

feed(t, green_frame(CX - outside, CY), STABLE_FRAMES + 3)
check(t.direction == "right", f"{outside} px clears the dead zone")

# Dominant axis wins, measured against each axis's own dead zone.
check(classify(100, 20, WIDTH, HEIGHT) == "right", "mostly-horizontal tilt is horizontal")
check(classify(20, 100, WIDTH, HEIGHT) == "down", "mostly-vertical tilt is vertical")
check(classify(0, 0, WIDTH, HEIGHT) == "none", "dead centre is none")


# -- hysteresis -------------------------------------------------------------

print("\nhysteresis")

t = calibrated_tracker()
t.process(green_frame(CX - 120, CY))
check(t.direction == "none", "one agreeing frame does not commit a new direction")
feed(t, green_frame(CX - 120, CY), STABLE_FRAMES - 1)
check(t.direction == "right", f"{STABLE_FRAMES} agreeing frames commit it")


# -- rejection --------------------------------------------------------------

print("\nblob rejection")

t = calibrated_tracker()
red = blank_frame()
cv2.circle(red, (CX - 120, CY), 20, (0, 0, 255), -1)
feed(t, red, 5)
check(not t.detected, "a red ball is not a marker")

t = calibrated_tracker()
speck = blank_frame()
cv2.circle(speck, (CX - 120, CY), 2, (0, 255, 0), -1)
feed(t, speck, 5)
check(not t.detected, "a green speck is below the minimum area")

t = calibrated_tracker()
bar = blank_frame()
cv2.rectangle(bar, (CX - 200, CY - 8), (CX - 40, CY + 8), (0, 255, 0), -1)
feed(t, bar, 5)
check(not t.detected, "a long green bar is not round enough")

# Largest qualifying blob wins, so a decoy cannot steal the command.
t = calibrated_tracker()
decoy = green_frame(CX - 120, CY, radius=28)
cv2.circle(decoy, (CX + 150, CY), 12, (0, 255, 0), -1)
feed(t, decoy, STABLE_FRAMES + 3)
check(t.direction == "right", "the largest green blob wins over a smaller decoy")


# -- lost marker ------------------------------------------------------------

print("\nlost marker")

t = calibrated_tracker()
feed(t, green_frame(CX - 120, CY), STABLE_FRAMES + 3)
t.process(blank_frame())
check(t.direction == "right", "a single dropped frame does not stop the chair")
check(not t.detected, "but the marker reads as not detected immediately")

time.sleep(LOST_MARKER_GRACE_SECONDS + 0.05)
t.process(blank_frame())
check(t.direction == "none", f"after {LOST_MARKER_GRACE_SECONDS}s grace the command clears")


# -- custom HSV window ------------------------------------------------------

print("\ncustom hsv window")

t = MarkerTracker()
t.set_hsv_range((0, 120, 70), (10, 255, 255))          # red instead of green
red = blank_frame()
cv2.circle(red, (CX, CY), 20, (0, 0, 255), -1)
feed(t, red, AUTO_CALIBRATE_FRAMES + 5)
check(t.calibrated and t.detected, "a retuned HSV window tracks a red marker")


# -- noisy background -------------------------------------------------------

print("\nnoisy background")

rng = np.random.default_rng(0)
t = MarkerTracker()
for _ in range(AUTO_CALIBRATE_FRAMES + 5):
    noisy = (rng.integers(0, 90, (HEIGHT, WIDTH, 3))).astype(np.uint8)
    cv2.circle(noisy, (CX, CY), 22, (0, 255, 0), -1)
    t.process(noisy)
check(t.calibrated, "calibrates against a noisy background")

for _ in range(STABLE_FRAMES + 3):
    noisy = (rng.integers(0, 90, (HEIGHT, WIDTH, 3))).astype(np.uint8)
    cv2.circle(noisy, (CX - 120, CY), 22, (0, 255, 0), -1)
    t.process(noisy)
check(t.direction == "right", "still classifies against a noisy background")


# -- annotation -------------------------------------------------------------

print("\nannotation")

t = calibrated_tracker()
annotated = t.process(green_frame(CX - 120, CY))
check(annotated.shape == (HEIGHT, WIDTH, 3), "process() returns a same-size BGR frame")
check(t.frame_size == (WIDTH, HEIGHT), "frame_size is (width, height)")


print(f"\n{checks - len(failures)}/{checks} checks passed")
for label in failures:
    print(f"  FAILED: {label}")
sys.exit(1 if failures else 0)
