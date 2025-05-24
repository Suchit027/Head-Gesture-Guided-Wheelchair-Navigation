# Head Gesture Guided Wheelchair Navigation
## Table of Contents -
- [Overview](#overview)
- [Methodology](#methodology)
- [Prerequisites](#prerequisites)

## Overview
People with neck-down paralysis require alternative methods to control their wheelchairs. Head gestures are one such method. While Arduino-based solutions exist, they often lack a training interface to help users understand how gestures influence acceleration, deceleration, and turning.

This project aims to fill that gap by providing a virtual training environment where users can practice and get comfortable with gesture-based control before using a real wheelchair.

## Methodology
There are two proposed methods to identify the guesture of the user.
1) Tracker-Based Detection (Higher Accuracy):
A small tracker is attached to the user's head using an elastic band. The system monitors the position of the tracker to determine the user's intended movement command (e.g., left turn, right turn, accelerate, decelerate).
3) Trackerless Detection Using Computer Vision:
This method uses OpenCV to track the position of the user's nose relative to a reference frame. The displacement from the neutral (rest) position is interpreted as a control input.
The input is then translated to a command like left turn, right turn, accelerate or deaccelerate.

## Prerequisites
- Python 3.8 or above
- Webcam-enabled device
