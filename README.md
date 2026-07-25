# Head Gesture Guided Wheelchair Navigation

A virtual training environment for people with neck-down paralysis to practise
driving a head-gesture-controlled wheelchair before using a real one.

You wear a small green ball on your head. A webcam tracks it, and the direction
you tilt your head drives a wheelchair through a 3D environment that you can
shape to match the corridor or ward you actually use.

> **Developers:** architecture, design decisions and gotchas live in
> [DEVELOPER.md](DEVELOPER.md). Superseded experiments are in
> [prototypes/](prototypes/README.md).

---

## Contents

- [What you need](#what-you-need)
- [Setup](#setup)
- [Your first session](#your-first-session)
- [Driving](#driving)
- [Building your own environment](#building-your-own-environment)
- [Tuning](#tuning)
- [Shutting down](#shutting-down)
- [Troubleshooting](#troubleshooting)
- [Platform notes](#platform-notes)

---

## What you need

| | |
|---|---|
| **Node.js** | 18 or newer |
| **Python** | 3.8 or newer (tested on 3.12) |
| **Webcam** | any built-in or USB camera |
| **A green ball** | matte, roughly 4–7 cm across, on an elastic band |

Matte beats glossy — a shiny highlight can split the ball into two blobs and
confuse the tracker. Avoid wearing green, and avoid green objects behind you.

**You can skip the ball and the camera entirely to start with.** The simulator
drives with arrow keys, which is the easiest way to explore it and lay out a
route before setting anything up.

---

## Setup

Do this once. Both commands run from the repository root.

### 1. Frontend

```bash
npm install --legacy-peer-deps
```

### 2. Backend

Create a fresh virtual environment — do not reuse any `venv` folder you may find
in an old clone.

**macOS / Linux**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

**Windows (PowerShell)**
```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

---

## Your first session

You need **two terminals**, both at the repository root.

### Terminal 1 — the camera backend

```bash
IDLE_TIMEOUT=600 .venv/bin/python backend/head_movement_detection.py
```

`IDLE_TIMEOUT=600` gives you 10 minutes instead of the default 2 before the
backend releases the camera on its own — enough time to fit the marker before
anything is using it. Drop it once you are set up.

Wait for `Camera opened via … Tracking green marker.`

> On first run your operating system will ask for camera permission. If you miss
> the prompt, see [Platform notes](#platform-notes).

### Check the tracking before going further

Open **<http://localhost:5001/>**. This is the backend's own diagnostic page and
it is the fastest way to tell a tracking problem from an app problem.

Put the ball on, face the camera, and confirm:

- a **red circle** follows the ball
- the **inset in the bottom-right corner** shows the ball as a solid white blob
  — this is what the colour filter sees, and if the ball is not clearly white
  there, no amount of head movement will work
- after a couple of seconds a **yellow box** appears — your neutral zone
- the banner reads `Direction: none` when still, and changes as you move

Do not continue until the red circle tracks reliably. Everything downstream
depends on it. If it does not, see [Troubleshooting](#troubleshooting).

### Terminal 2 — the simulator

```bash
npm run dev
```

Open **<http://localhost:3000/>** (http, not https).

### In the app

Go to the **Head** tab. The camera view is at the top of this tab so you can
watch yourself while you set up. Then, in order:

1. **Enable Head Control** — the status should turn green and read `Tracking`.
2. Face straight ahead and press **Set neutral position**.
3. **Start Simulation**.

Step 2 is the one people skip. Every gesture is measured as movement *away from*
that neutral position, so if you set it while looking off to one side, the chair
will pull to that side constantly.

---

## Driving

Move your **head**, not just your eyes — the ball has to leave the yellow box.

| Gesture | Effect |
|---|---|
| Tilt **up** | Accelerate |
| Tilt **down** | Slow down, then reverse |
| Tilt **left / right** | Steer, without changing speed |
| Hold still | Keep going at the current speed |

Two behaviours that are deliberate and worth knowing:

**Speed sticks.** Tilting left to steer does not slow you down. Only up and down
change your speed. This is because the tracker reports one direction at a time,
so needing to steer and accelerate simultaneously would make it undrivable.

**Steering from a standstill creeps forward.** Holding left or right brings the
chair up to a slow walk on its own, so getting round a corner does not mean
alternating between "accelerate" and "turn". Tilting down always overrides it,
down to a full stop and into reverse.

The **speed limit** control sets a ceiling for the whole session. Start low —
0.5 m/s — and raise it as you get comfortable. The world is scaled to a real
powered wheelchair: about 1.5 m/s top speed and paths 1.2–1.8 m wide.

**Arrow keys work whenever head control is off**, which is useful for checking a
route before a session.

---

## Building your own environment

Three practice routes ship with the app: a rectangular corridor loop, a
cornerless ring, and a city block.

Beyond those, **Environments → Draw new environment** opens a top-down editor
where you click out a route on a grid marked in metres — so you can recreate the
actual loop of your own hallway or ward and practise that. The line you draw is
the **centre** of the path; the floor, kerbs and surroundings are generated
around it.

Corners are rounded to a radius you choose so they stay drivable. The editor
refuses paths that cross themselves and warns about hairpins or sections
narrower than the path itself. Environments are saved in your browser, and can
be exported and imported as JSON files to move between machines.

---

## Tuning

### The neutral zone (the yellow box)

While the ball is inside the box you count as holding still. Its size is the main
comfort setting.

| Too small | Too big |
|---|---|
| Ordinary swaying issues commands; the chair feels twitchy | Steering needs large, tiring head movements |

Adjust it live, without restarting:

```bash
curl -X POST localhost:5001/settings -H 'Content-Type: application/json' \
  -d '{"deadZone": {"x": 0.12, "y": 0.10}}'
```

Values are fractions of the camera frame, clamped to 0.01–0.35. Defaults are
`x: 0.09`, `y: 0.075`. Vertical is smaller than horizontal on purpose — most
people have less comfortable up/down neck movement than side to side.

### The colour filter

If the ball is not a solid white blob in the corner inset, the lighting does not
match the default green range. Widen it:

```bash
curl -X POST localhost:5001/settings -H 'Content-Type: application/json' \
  -d '{"lower":[35,60,40],"upper":[95,255,255]}'
```

`GET /status` reports the current settings for both.

---

## Shutting down

Press **Ctrl-C** in each terminal. The camera light goes out on its own.

It also goes out if you simply close the terminal, if whatever launched the
backend exits, or after `IDLE_TIMEOUT` seconds (default 120) with nothing using
it — so closing the simulator in your browser is enough. An open video feed or a
running session counts as use and is never interrupted.

To confirm nothing still holds the camera: `lsof | grep VDC` on macOS. Entries
for `ControlCenter` and `avconferenced` are normal system processes and do not
mean the camera is on.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| `Cannot reach the tracking backend` | The backend is not running, or it released the camera after being idle. Restart it with a larger `IDLE_TIMEOUT`. |
| The backend quit while you were still setting up | That is the 120 s idle default. Use `IDLE_TIMEOUT=600`. |
| `Backend running, but no camera` | Camera permission not granted, or another app (Teams, Zoom, a browser tab) is holding the camera. Close it and restart the backend. |
| `Green marker not visible` | Check the corner inset on <http://localhost:5001/>. If the ball is not white there, retune the [colour filter](#the-colour-filter) or improve the lighting. |
| Ball detected but the chair drifts | Re-do **Set neutral position** while facing straight ahead. |
| The chair feels twitchy | Make the [neutral zone](#the-neutral-zone-the-yellow-box) bigger. |
| Steering is hard work | Make the neutral zone smaller. |
| Two green things in shot | The largest one wins. Remove the other. |
| `403 Forbidden` from the backend | You are on port 5000, which macOS AirPlay Receiver takes. Use 5001. |
| Port 5001 already in use | Start with `PORT=5002 …` and set `NEXT_PUBLIC_BACKEND_URL=http://localhost:5002`, then restart `npm run dev`. |

---

## Platform notes

The stack is cross-platform. Where the platforms genuinely differ:

| | macOS | Windows | Linux |
|---|---|---|---|
| Camera backend | AVFoundation | DirectShow, then Media Foundation | V4L2 |
| Granting camera access | System Settings → Privacy & Security → Camera → enable your terminal | Settings → Privacy & security → Camera → allow desktop apps | add your user to the `video` group |
| Port 5000 | taken by AirPlay Receiver — the backend uses 5001 | usually free | usually free |

The backend picks the camera backend automatically and `GET /status` reports
which one it used. On Windows it tries DirectShow before Media Foundation,
because MSMF is OpenCV's default there but often takes several seconds to open a
built-in webcam, or fails on it entirely.

> Windows support is implemented and reasoned about but **has not been tested on
> a Windows machine**.
