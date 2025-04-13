import cv2
from flask import Flask, Response, jsonify
from flask_cors import CORS
import time
import numpy as np

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# amount of movement of head considered as no real gesture in each axis
NO_MOVEMENT_HORIZONTAL, NO_MOVEMENT_VERTICAL = 5, 3
# number of frames observed
NUM_FRAMES = 0
# original centroid of face with respect to image taken by camera
ORIGINAL_I, ORIGINAL_J = None, None
# current direction
current_direction = "none"

def command(face_i, face_j, width, height, debug=False):
    global ORIGINAL_J, ORIGINAL_I, NO_MOVEMENT_VERTICAL, NO_MOVEMENT_HORIZONTAL, current_direction
    # centroid of user's face
    centroid_i, centroid_j = face_i + (width // 2), face_j + (height // 2)

    if debug:
        print(ORIGINAL_I, ORIGINAL_J)
        print(centroid_i, centroid_j)

    if centroid_i - ORIGINAL_I > NO_MOVEMENT_HORIZONTAL:
        current_direction = 'right'
    elif ORIGINAL_I - centroid_i > NO_MOVEMENT_HORIZONTAL:
        current_direction = 'left'
    elif ORIGINAL_J - centroid_j + 5 > NO_MOVEMENT_VERTICAL:
        current_direction = 'up'
    elif centroid_j - ORIGINAL_J > NO_MOVEMENT_VERTICAL:
        current_direction = 'down'
    else:
        current_direction = 'none'

    return current_direction

def gen_frames():
    global NUM_FRAMES, ORIGINAL_I, ORIGINAL_J, current_direction
    # XML file for detecting face
    face_cascade = cv2.CascadeClassifier('backend/lbpcascade_frontalface_improved.xml')
    # starting video and capturing frames
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Could not open camera.")
        # Return a blank frame if camera is not available
        blank_frame = cv2.imread('backend/blank.jpg') if cv2.imread('backend/blank.jpg') is not None else cv2.zeros((480, 640, 3), dtype=np.uint8)
        _, buffer = cv2.imencode('.jpg', blank_frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        return

    # Initialize face position
    face_found = False
    while not face_found and NUM_FRAMES < 30:  # Try for 30 frames to find a face
        ret, img = cap.read()
        if not ret:
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(15, 15))
            
        if len(faces) > 0:
            face_found = True
            ORIGINAL_I, ORIGINAL_J, w, h = faces[0]
            cv2.rectangle(img, (ORIGINAL_I, ORIGINAL_J),
                        (ORIGINAL_I + w, ORIGINAL_J + h), (255, 255, 0), 2)
            # setting the face centroids
            ORIGINAL_I += (w // 2)
            ORIGINAL_J += (h // 2)
            print(f"Original face position set: {ORIGINAL_I}, {ORIGINAL_J}")

    while True:
        ret, img = cap.read()
        if not ret:
            break
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(15, 15))

        if len(faces) > 0:
            i, j, w, h = faces[0]
            cv2.rectangle(img, (i, j), (i + w, j + h), (255, 255, 0), 2)
            
            # Draw face centroid
            centroid_i, centroid_j = i + (w // 2), j + (h // 2)
            cv2.circle(img, (centroid_i, centroid_j), 3, (0, 255, 0), -1)
            
            # Draw original centroid
            if ORIGINAL_I is not None and ORIGINAL_J is not None:
                cv2.circle(img, (ORIGINAL_I, ORIGINAL_J), 3, (0, 0, 255), -1)
                
                # Draw line between original and current centroid
                cv2.line(img, (ORIGINAL_I, ORIGINAL_J), (centroid_i, centroid_j), (255, 0, 0), 2)

            if NUM_FRAMES % 10 == 0:  # Check direction every 10 frames
                direction = command(i, j, w, h, debug=False)
                cv2.putText(img, f"Direction: {direction}", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            NUM_FRAMES = (NUM_FRAMES + 1) % 100  # Reset after 100 frames
        else:
            cv2.putText(img, "No face detected", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            current_direction = "none"

        # Add direction indicators
        cv2.putText(img, f"Direction: {current_direction}", (10, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                    
        # Add control regions
        height, width = img.shape[:2]
        # Top region
        cv2.rectangle(img, (width//2 - 50, 10), (width//2 + 50, 110), 
                     (0, 255, 0) if current_direction == "up" else (0, 0, 255), 2)
        cv2.putText(img, "UP", (width//2 - 20, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    
        # Bottom region
        cv2.rectangle(img, (width//2 - 50, height - 110), (width//2 + 50, height - 10), 
                     (0, 255, 0) if current_direction == "down" else (0, 0, 255), 2)
        cv2.putText(img, "DOWN", (width//2 - 30, height - 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    
        # Left region
        cv2.rectangle(img, (10, height//2 - 50), (110, height//2 + 50), 
                     (0, 255, 0) if current_direction == "left" else (0, 0, 255), 2)
        cv2.putText(img, "LEFT", (30, height//2 + 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    
        # Right region
        cv2.rectangle(img, (width - 110, height//2 - 50), (width - 10, height//2 + 50), 
                     (0, 255, 0) if current_direction == "right" else (0, 0, 255), 2)
        cv2.putText(img, "RIGHT", (width - 90, height//2 + 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Convert frame to JPEG
        ret, buffer = cv2.imencode('.jpg', img)
        frame = buffer.tobytes()
        
        # Yield the frame in the byte format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video_feed')
def video_feed():
    """
    Video streaming route
    """
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/head_direction')
def head_direction():
    """
    Return the current head direction as JSON
    """
    return jsonify({"direction": current_direction})

@app.route('/')
def index():
    """
    Main page
    """
    return """
    <html>
    <head>
        <title>Head Movement Detection</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
            .container { max-width: 800px; margin: 0 auto; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Head Movement Detection</h1>
            <p>Current direction: <span id="direction">Loading...</span></p>
            <div class="video-container">
              <h1>Live Video Feed</h1>
              <img src="/video_feed" alt="Live Processed Video" width="600" height="400" />
            </div>
        </div>
        <script>
            // Update direction every 200ms
            setInterval(async function() {
                const response = await fetch('/head_direction');
                const data = await response.json();
                document.getElementById('direction').textContent = data.direction;
            }, 200);
        </script>
    </body>
    </html>
    """

if __name__ == '__main__':
    try:
        print("Starting Head Movement Detection Server...")
        print("Access the video feed at http://localhost:5000/video_feed")
        print("Get the current direction at http://localhost:5000/head_direction")
        app.run(host='0.0.0.0', port=5000, debug=True)
    finally:
        # Release the camera when the app is closed
        cv2.destroyAllWindows()
