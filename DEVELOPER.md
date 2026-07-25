# Developer notes

Everything about this repo that is not "how do I run it". For setup and daily
use, see [README.md](README.md).

- [Repository layout](#repository-layout)
- [Architecture](#architecture)
- [Design decisions worth not undoing](#design-decisions-worth-not-undoing)
- [The heading/yaw convention — read before touching rotations](#the-headingyaw-convention--read-before-touching-rotations)
- [Camera lifecycle](#camera-lifecycle)
- [Environment gotchas](#environment-gotchas)
- [Testing](#testing)
- [Known loose ends](#known-loose-ends)

---

## Repository layout

```
app/                 Next.js app router. page.tsx owns all session state.
components/
  wheelchair-simulation.tsx   R3F canvas, chase camera, telemetry
  tracks/polygon-track.tsx    data-driven scenery for any polygon
  track-editor.tsx            top-down SVG route editor
  head-movement-indicator.tsx gesture panel + backend polling
  video-feed.tsx              annotated MJPEG view
  ui/                         only the 6 shadcn components actually used
lib/
  track.ts             track geometry — the centre of gravity of the project
  wheelchair-model.ts  motion model, deliberately headless
  track-storage.ts     localStorage persistence + JSON import/export
  backend.ts           backend URLs, one place
backend/
  marker_tracking.py           detection, no Flask dependency
  head_movement_detection.py   Flask server + process lifecycle
prototypes/          superseded experiments, nothing imports them
```

## Architecture

Two halves. The **Next.js + React Three Fiber frontend** is the simulator and
route editor; the **Python/Flask + OpenCV backend** watches a green marker and
reports a direction over HTTP. The frontend is fully usable without the backend
— arrow keys drive.

### `lib/track.ts` — track geometry

- **`TrackSpec`** is the serialisable track: `points` (closed polygon, the
  **centreline**, in metres), `width`, `cornerRadius`, `theme`, plus id/name.
- **`filletPolygon()`** rounds corners with true circular arcs and keeps
  straights dead straight. A Catmull-Rom spline was tried and rejected: it bows
  the straights, so a drawn square comes out as a blob — wrong when someone is
  recreating a real corridor. Radius is clamped per corner so adjacent fillets
  cannot overlap.
- **`Centerline`** resamples at uniform arc length (`SAMPLE_SPACING = 0.35 m`)
  and answers the per-frame query `nearest(x, z, hint)` →
  `{ index, s, lateral, tangent, point }`. Uses a ±30-sample window around the
  hint, with a full-scan fallback when the result lands on the window edge.
- **`buildRibbonGeometry()`** — road surface and kerbs as closed triangle strips.
- **`posesAlong()`** — evenly spaced `{ position, normal, heading, s }` for
  dashes and scenery. Returns `normal` so callers can push a prop out by its own
  size.
- **`footprintClearsPath()`** — samples an object's footprint and reports
  whether it clears the path edge. Guards against offset-curve folding.
- **`validateTrack()`** — errors (fewer than 3 points, duplicate points,
  self-intersection) vs warnings (hairpins, segments narrower than the path).

### `lib/wheelchair-model.ts` — motion

Free of React and Three.js **so it can be tested headlessly. Keep it that way.**

A kinematic unicycle: state is `(x, z, heading, speed)`. There is no rigid-body
physics — `@react-three/cannon` was dropped for the chair. A powered chair on a
flat floor is fully described by that state, and path-edge collision is answered
analytically from the centreline, which is cheaper, exact, and works for any
polygon.

Tuning, all SI: `ACCELERATION 0.55`, `BRAKING 0.9`, `COAST 0.3`,
`MAX_TURN_RATE 55°/s`, `REVERSE_FRACTION 0.35`, `OFF_TRACK_SPEED_FACTOR 0.45`,
`MAX_TIMESTEP 0.1`, `TURN_ASSIST_SPEED 0.35`, `TURN_ASSIST_MAX_FRACTION 0.5`.

### `components/wheelchair-simulation.tsx` — rendering

Owns the canvas, the chase camera and telemetry. Chair state lives in a `useRef`,
not React state — it changes every frame. Telemetry is throttled to 10 Hz before
it reaches React. Camera modes: `chase` (damped, behind, aimed 4 m ahead),
`first` (1.2 m eye height), `overview` (top-down).

### `backend/` — gesture detection

`marker_tracking.py` has **no Flask dependency**, so detection is testable
headlessly. **Keep it that way.**

HSV segmentation → morphological open+close → largest sufficiently-round blob
wins. Commands come from **displacement relative to a calibrated rest position**,
never from fixed screen zones. Auto-calibrates after 15 stable frames.

## Design decisions worth not undoing

**Speed is persistent.** Up/down change it; left/right steer without altering it.
The detector emits one direction at a time (its classifier is an if/elif chain),
so a model needing simultaneous throttle and steering would be undrivable.

**Turn assist.** Holding left/right creeps up to 0.35 m/s, capped at half the
session speed limit, and only when moving forwards — turning while reversing
steers the reverse. `up`/`down` are separate switch cases that never consult the
assist floor, so explicit commands always override it.

**Frames are mirrored** (`cv2.flip(frame, 1)`). Raw webcam output is not
mirrored, so without this left/right are inverted — worse than useless here.

**Displacement, not screen zones.** The camera is never in the same place twice
and neutral head position varies per session.

**Never fabricate gesture input.** The head-movement indicator used to fall back
to random directions when the backend was unreachable, which would let a whole
training session run on noise while looking exactly like a working one. It now
stops the chair and reports the disconnected state, and distinguishes "holding
still" from "marker not visible" — both produce no movement but mean opposite
things to a trainee. The mock `/api/head-movement` route that did the same thing
has been deleted; do not reintroduce it.

**One thread owns the camera.** `/video_feed` serves the latest annotated frame,
so multiple viewers never fight for the device. An earlier version opened a
capture inside the request handler, so a page refresh fought the first viewer and
no direction was produced when nobody was watching.

## The heading/yaw convention — read before touching rotations

**Heading is not a Three.js Y-rotation.** Heading is measured clockwise from −Z
(`atan2(t.x, -t.z)`); `rotation.y` is counter-clockwise. Assigning one to the
other **mirrors the object about the Z axis**.

| heading | travels toward | `rotation.y = heading` faces |
|---|---|---|
| 0 | (0.000, −1.000) | (0.000, −1.000) ✓ |
| π/2 | (**1.000**, 0.000) | (**−1.000**, 0.000) ✗ |
| 0.70 | (**0.644**, −0.765) | (**−0.644**, −0.765) ✗ |

Always go through **`yawForHeading(heading)`** in `lib/track.ts`.

This bug shipped twice, because the symptom is deceptive. First on the rider: at
a quarter turn the chair drove toward +X while the model faced −X, i.e.
backwards into the chase camera — read as "the person doesn't turn". Then on all
7 scenery props, which were not swept after the first fix. The orientation error
is `2 × heading`, and a box is symmetric under 180° yaw, so on a rectangular
track's straights (0°/90°/180°/270°) walls looked **perfectly fine** and only
went broadside at corners — read as "random walls on the track".

**Fixing this convention anywhere means grepping for every
`rotation={[0, heading` and `rotation.y =` in the codebase.**

The flat-plane cases (centre dashes, start line) use
`rotation={[-Math.PI/2, 0, -pose.heading]}` — a different composition,
separately derived, and correct. Do not "unify" them without redoing the maths.

### Related: scenery placement must know prop size

`describeProp()` decides a prop's dimensions **once**, and those dimensions drive
both placement and geometry. This coupling is load-bearing. Previously size was
picked from `rand` while placement used a fixed offset, so an 8 m-wide building
was dropped 4 m from the centreline with half of it on the path. Placement now
offsets by the prop's own **lateral** half-extent (a wall is 0.08 m across even
though it is 3.6 m long, so corridors stay tight), and `footprintClearsPath()`
drops anything that still overlaps — which happens on corners tighter than the
offset, where the offset curve folds back through itself.

## Camera lifecycle

The backend releases the camera on every exit path. Three mechanisms, because no
single one is sufficient:

1. **Signal handlers** (`SIGINT`/`SIGTERM`/`SIGHUP`) — covers Ctrl-C and closing
   a terminal that owns the process in its foreground group.
2. **Orphan watchdog** — polls `getppid()`; exits when the launching process
   disappears. POSIX only: Windows has no reparenting, but it terminates
   console-attached processes itself.
3. **Idle timeout** (`IDLE_TIMEOUT`, default 120 s) — no client requests, no
   camera.

**The idle timeout is the real safety net**, because 1 and 2 both key off *how
the process was launched* and neither is airtight. A launcher that spawns the
server detached and immediately exits leaves no parent to notice dying and no
controlling terminal to send `SIGHUP`; `getppid()` already reads 1 by the time
the watchdog installs, so it disables itself. This was not theoretical — it is
exactly how a stale server was found holding the camera for 21 minutes.

Watching the controlling terminal directly was tried and **rejected**. Measured
on macOS: `/dev/tty` stays openable after the terminal dies, and `poll()` returns
`POLLNVAL` on ttys. `select()` + `read()` does detect the hangup (EOF), but
reading a tty from a background job raises `SIGTTIN` and suspends the server, and
it would swallow stdin. Not worth it.

Note `tracker.stop()` deliberately does **not** force-release the device if the
capture thread is still inside a blocking `read()` after the join timeout —
tearing a capture down under an in-flight read crashes the AVFoundation and MSMF
backends, and process exit closes the handle anyway.

Since `/video_feed` is one long-lived request, `frame_stream()` refreshes the
activity timestamp per frame; otherwise the idle watchdog would kill a server
that is actively streaming.

## Environment gotchas

Each of these cost real debugging time.

1. **Port 5000 is taken by macOS AirPlay Receiver.** Every endpoint returned
   `403 Forbidden` with `Server: AirTunes/…`. The backend defaults to **5001**
   (`PORT=` to override; the frontend uses `NEXT_PUBLIC_BACKEND_URL`, inlined at
   build time, so a change needs a dev-server restart).
2. **OpenCV cannot request camera permission from a worker thread** on macOS
   ("can not spin main run loop from other thread"). `open_camera()` must be
   called on the **main** thread; only the read loop is threaded. Opening it in
   the thread produced `cameraOk: false`.
3. **OpenCV must stay on 4.x** — pinned `opencv-python>=4.8,<5`.
4. **The original requirements pins would not install on Python 3.12** (numpy
   1.21.2, opencv 4.5.3.56 predate it). Replaced with ranges, verified against
   Flask 3.1.3 / flask-cors 6.0.5 / opencv 4.13.0.92 / numpy 2.5.1.
5. **Windows is reasoned about, not tested** — no Windows machine available. The
   camera-backend order (DirectShow → MSMF → default) addresses the known MSMF
   slowness but is unverified. `GET /status` names the backend actually used.

## Testing

There is one committed test suite:

```bash
.venv/bin/python backend/test_marker_smoke.py    # 32 checks, no camera, no Flask
```

It drives `MarkerTracker.process()` with synthetic frames — calibration,
all four gestures, the mirroring sense on both axes, dead-zone boundaries,
hysteresis, blob rejection (red ball, speck, non-circular bar, smaller decoy),
lost-marker grace, a retuned HSV window, and a noisy background. It derives its
thresholds from the module constants, so retuning them moves the expectations
automatically.

**There is still no test runner and no frontend tests.** Adding one (vitest for
TS, pytest for Python) remains the single highest-value follow-up. The rest of
the verification below was done with throwaway scripts that were never
committed.

What those scripts covered, if they need rebuilding:

- **Geometry (40 checks)** — fillet containment, straights staying straight,
  sample uniformity, tangent/normal orthogonality, `nearest()` sign convention,
  hinted search agreeing with full scan at every sample, stale-hint recovery,
  monotonic arc length, self-intersection rejection.
- **Drive model (54 checks)** — speed caps, framerate independence across
  30/60/144 fps, speed-dependent yaw limiting, turn-in-place, off-path penalty,
  wrong-way detection, stalled-frame clamping, autopilot completing laps on all
  builtins, the yaw convention, every turn-assist behaviour.
- **Marker tracking (40 checks)** — blob localisation, rejection of a red ball /
  a speck / a non-circular green bar, largest-blob-wins with a decoy, dead-zone
  and dominant-axis classification, auto and manual calibration, all four
  gestures, mirroring sense on both axes, hysteresis, lost-marker fallback,
  noisy background, custom HSV window.
- **Scenery (12 checks)** — reconstructs each prop's true rectangular footprint
  in world space and measures closest approach to the centreline, over the three
  builtins plus five deliberately awkward polygons (3×3 m loop, 1.5 m slot, two
  concave L-shapes, hairpin zigzag), plus a control proving the guard is not
  vacuous.
- **Camera lifecycle** — each of `SIGHUP`/`SIGTERM`/`SIGINT` releasing the
  device, the orphan watchdog firing when a parent that outlives startup dies,
  the idle timeout firing, and an active 14 s video stream *not* being killed by
  a 6 s idle timeout.
- **Dead zone (11 checks)** — thresholds either side of the new boundary, custom
  zones overriding defaults, clamping, stale-command clearing on resize, and the
  drawn overlay following the instance value rather than the module constant.

Two test-writing traps hit repeatedly: accelerating in a straight line on a
**curved** track drives off the path, and the off-track penalty then caps speed
at `0.45 × cap` — which looks like a broken speed cap. Use a straight section of
the Corridor Loop for speed tests. The same confound produced a bogus "steering
is mirrored" failure.

Standing verification:

```bash
npx tsc --noEmit      # clean under strict
npx next build        # clean
```

## Known loose ends

- **No test runner, and no frontend tests** (above). Highest-value next step.
  `backend/test_marker_smoke.py` is a plain script with its own `check()`
  helper; folding it into pytest would be the natural first move.
- **`venv/` history.** The Windows virtualenv is no longer tracked, but it is
  still in git history, which is why `.git` is ~58 MB. Shrinking that needs a
  history rewrite (`git filter-repo`), which breaks every existing clone — a
  deliberate decision for whoever owns the remote, not a cleanup task.
- **Windows untested** (above).
- **Dead zone has no UI.** Tuning is a `curl` to `POST /settings`. A slider in
  the Head panel would be a natural addition.
