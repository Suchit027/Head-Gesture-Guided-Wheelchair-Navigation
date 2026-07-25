import cv2
import numpy as np

# determines the direction which user wants to go to using a green colored head mounted ball (accessory)
def direction(ball_pos, left_box, right_box, upper_box, lower_box, frame_center):

    if left_box[0] - 50 <= ball_pos[0] <= left_box[0] + 50 and left_box[1] - 100 <= ball_pos[1] <= left_box[1] + 100:
        print('left')
    elif right_box[0] - 50 <= ball_pos[0] <= right_box[0] + 50 and right_box[1] - 100 <= ball_pos[1] <= right_box[1] + 100:
        print('right')
    elif upper_box[0] - 50 <= ball_pos[0] <= upper_box[0] + 50 and upper_box[1] - 100 <= ball_pos[1] <= upper_box[1] + 100:
        print('up')
    elif lower_box[0] - 50 <= ball_pos[0] <= lower_box[0] + 50 and lower_box[1] - 100 <= ball_pos[1] <= lower_box[1] + 100:
        print('down')
    elif frame_center[0] - 100 <= ball_pos[0] <= frame_center[0] + 100 and frame_center[1] - 100 <= ball_pos[1] <= frame_center[1] + 100:
        # if time elapsed while, then user fails
        print('waiting for decision')
    else:
        print('error')
    return


# detects the green colored ball (accessary) and triggers the direction detection
def movement_capture():

    cap = cv2.VideoCapture(0)

    while True:

        ret, frame = cap.read()
        if not ret:
            break

        height, width = frame.shape[: 2]
        center_y, center_x = height // 2, width // 2

        # drawing right box
        cv2.rectangle(frame, (center_x + 100, center_y - 100),
                      (center_x + 200, center_y + 100), 10)

        # drawing left box
        cv2.rectangle(frame, (center_x - 100, center_y - 100),
                      (center_x - 200, center_y + 100), 10)

        # drawing upper box
        cv2.rectangle(frame, (center_x - 50, center_y - 150),
                      (center_x + 50, center_y - 100), 10)

        # drawing lower box
        cv2.rectangle(frame, (center_x - 50, center_y + 100),
                      (center_x + 50, center_y + 150), 10)

        # color detection in hsv is more accurate
        frame_hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        # lowest color of green allowed due to lighting conditions
        lower_green = np.array([40, 40, 40])
        # highest color of green allowed due to lighting conditions
        upper_green = np.array([90, 255, 255])
        # thresholding image on the basis of range defined above
        mask = cv2.inRange(frame_hsv, lower_green, upper_green)

        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            # Filter out small areas
            if area > 200:
                # creating a circle around it
                (x, y), radius = cv2.minEnclosingCircle(cnt)
                # circularity is measure of how much an enclosed figure is a circle. Perfect circle has a score of 1.0
                circularity = 4 * np.pi * area / \
                    (cv2.arcLength(cnt, True) ** 2)
                if 0.7 < circularity < 1.2:
                    center = (int(x), int(y))
                    radius = int(radius)
                    cv2.circle(frame, center, radius, (0, 0, 255), 2)
                    direction(ball_pos=center, left_box=(center_x - 150, center_y), right_box=(center_x + 150,
                              center_y), upper_box=(center_x, center_y - 125), lower_box=(center_x, center_y + 125), frame_center=(center_x, center_y))

        cv2.imshow("Green Circle Detection", frame)

        # Press 'q' to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    return


if __name__ == '__main__':
    movement_capture()
