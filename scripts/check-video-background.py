"""Check every decoded frame for background drift, including the entire overlap."""
import json
import sys

import cv2
import numpy as np

cv2.setNumThreads(2)
cap = cv2.VideoCapture(sys.argv[1])
width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
frames = []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    frames.append(cv2.cvtColor(cv2.resize(frame, (640, 360)), cv2.COLOR_BGR2GRAY))
cap.release()
if not frames:
    raise RuntimeError('No decoded video frames')
sift = cv2.SIFT_create(nfeatures=1800)
mask = np.zeros_like(frames[0])
mask[:170] = 255
mask[:, :65] = 255
mask[100:220, 380:620] = 255
keypoints, descriptors = sift.detectAndCompute(frames[len(frames) // 2], mask)
matcher = cv2.BFMatcher()
drift, match_counts = [], []
for index, frame in enumerate(frames):
    points, features = sift.detectAndCompute(frame, None)
    matches = [a for a, b in matcher.knnMatch(features, descriptors, k=2) if a.distance < .7 * b.distance]
    if len(matches) < 40:
        raise RuntimeError(f'Frame {index}: too few background matches')
    src = np.float32([points[m.queryIdx].pt for m in matches])
    dst = np.float32([keypoints[m.trainIdx].pt for m in matches])
    # Do not align again: measure the actual exported video's displacement.
    drift.append(float(np.median(np.linalg.norm(src - dst, axis=1))) * width / 640)
    match_counts.append(len(matches))
result = {'checkedFrames': len(frames), 'minimumMatches': min(match_counts),
          'maxMedianDisplacementPixels': max(drift), 'worstFrame': int(np.argmax(drift))}
print(json.dumps(result), flush=True)
# Allow under 0.25% of the 1280px export width for source deformation and
# subpixel SIFT/codec measurement noise; large camera resets still fail.
if max(drift) > 3:
    raise RuntimeError(f'Background drift exceeds three pixels: {result}')
