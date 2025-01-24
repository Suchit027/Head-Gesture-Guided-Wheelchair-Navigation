import cv2

# amount of movement of head considered as no real gesture in each axis
NO_MOVEMENT_HORIZONTAL, NO_MOVEMENT_VERTICAL = 5, 3
# number of frames observed; set based on frame per second. Our machine is at 30 fps
NUM_FRAMES = 0
# original centroid of face with respect to image taken by camera
ORIGINAL_I, ORIGINAL_J = None, None


# responsible for recognizing the command given by the user
def command(face_i, face_j, width, height, debug):

    global ORIGINAL_J, ORIGINAL_I, NO_MOVEMENT_VERTICAL, NO_MOVEMENT_HORIZONTAL
    # centroid of user's face
    centroid_i, centroid_j = face_i + (width // 2), face_j + (height // 2)

    if debug:
        print(ORIGINAL_I, ORIGINAL_J)
        print(centroid_i, centroid_j)

    if centroid_i - ORIGINAL_I > NO_MOVEMENT_HORIZONTAL:
        print('right')
    elif ORIGINAL_I - centroid_i > NO_MOVEMENT_HORIZONTAL:
        print('left')
    elif ORIGINAL_J - centroid_j > NO_MOVEMENT_VERTICAL:
        print('up')
    elif centroid_j - ORIGINAL_J > NO_MOVEMENT_VERTICAL:
        print('down')
    else:
        print('error')

    return


# for detecting the position of the user's face
def face_detect(debug):

    global NUM_FRAMES, ORIGINAL_I, ORIGINAL_J
    # XML file for detecting face. Its a classifier trained to detect faces fast.
    face_cascade = cv2.CascadeClassifier('lbpcascade_frontalface_improved.xml')
    # starting video and capturing frames
    cap = cv2.VideoCapture(0)

    while True:
        # read frames
        ret, img = cap.read()
        # converting to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # detecting faces
        face = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(15, 15))

        # face is a list, we only want to detect one face, so we should select the first value in face we get
        # but when moving the face, the program may not detect any face at all; so we check if face detected or not
        if len(face) > 0:
            i, j, w, h = face[0]
            cv2.rectangle(img, (i, j), (i + w, j + h), (255, 255, 0), 2)

            if NUM_FRAMES == 35:
                command(i, j, w, h, debug= debug)
            elif NUM_FRAMES == 60:
                ORIGINAL_I, ORIGINAL_J = i + (w // 2), j + (h // 2)
                print('give direction')

            NUM_FRAMES = (NUM_FRAMES + 1) % 61

        # displaying the image
        cv2.imshow('img', img)
        # setting esc key for breaking out of the loop
        k = cv2.waitKey(60) & 0xff
        if k == 27:
            break

    cap.release()

    cv2.destroyAllWindows()
    return


# for defining the original position of the face of the user
def face_position_set():

    global ORIGINAL_I, ORIGINAL_J
    # face detector
    face_cascade = cv2.CascadeClassifier('lbpcascade_frontalface_improved.xml')
    # starting video and capturing frames
    cap = cv2.VideoCapture(0)
    # face found or not
    found = False

    while not found:
        # read frames
        ret, img = cap.read()
        # converting to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # detecting faces
        face = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(15, 15))
        # face is a list, we only want to detect one face, so we should select the first value in face we get
        # but when moving the face, the program may not detect any face at all
        if len(face) > 0:
            found = True
            ORIGINAL_I, ORIGINAL_J, w, h = face[0]
            cv2.rectangle(img, (ORIGINAL_I, ORIGINAL_J),
                          (ORIGINAL_I + w, ORIGINAL_J + h), (255, 255, 0), 2)
            # setting the face centroids
            ORIGINAL_I += (w // 2)
            ORIGINAL_J += (h // 2)
        # displaying the image
        cv2.imshow('img', img)
        # setting esc key for breaking out of the loop
        k = cv2.waitKey(60) & 0xff
        if k == 27:
            break
    cap.release()
    cv2.destroyAllWindows()
    return


if __name__ == '__main__':
    face_position_set()
    face_detect(debug=False)
