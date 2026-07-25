# Prototypes

Earlier standalone experiments, kept for reference. **Nothing in the running
application imports any of this** — the live gesture backend is
`backend/marker_tracking.py` and `backend/head_movement_detection.py`.

They are here because each one records an approach that was tried and moved on
from, which is worth more as a record than as deleted history.

| File | What it was | Why it was superseded |
|---|---|---|
| `head_marker_navigation.py` | First green-ball tracker. Classifies direction by testing the ball against four fixed screen boxes and `print`s the result. | Fixed screen zones assume the camera and the user's neutral head position are in the same place every session, which they never are. The backend measures **displacement from a calibrated rest position** instead. |
| `face_direction_tracker.py` | The trackerless approach: Haar/LBP face detection, direction from movement of the face centroid. | Needs no marker, but is far less robust — it loses the face on turns, which is exactly when a command matters. Was never wired to the HTTP server. |
| `lbpcascade_frontalface_improved.xml` | Cascade classifier data for the above. | Only `face_direction_tracker.py` reads it. |

## Running them

Both open the camera directly and are driven from the terminal, not the browser.
Stop them with `Esc` in the video window (they will not respond to Ctrl-C while
OpenCV has the window focus).

```bash
.venv/bin/python prototypes/face_direction_tracker.py
.venv/bin/python prototypes/head_marker_navigation.py
```

They can be launched from any directory — the cascade is resolved relative to
the script rather than the working directory.

> These scripts do **not** have the camera-release handling that the real
> backend has, so if one is killed abruptly it can leave the camera light on.
> Check with `lsof | grep VDC` and kill the leftover process if so.
