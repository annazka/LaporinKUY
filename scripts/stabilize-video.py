"""Align a panning clip to one fixed background before making its loop.

Install scripts/video-requirements.txt. Unlike a bounded displacement search,
feature matching handles the full pan, including the last frames of the clip.
"""
import json
from pathlib import Path
import subprocess
import sys

import cv2
import numpy as np

cv2.setNumThreads(2)
source, destination, metadata = map(Path, sys.argv[1:])
cap = cv2.VideoCapture(str(source))
fps = cap.get(cv2.CAP_PROP_FPS)
width, height = int(cap.get(3)), int(cap.get(4))
small_width = 640
small_height = round(height * small_width / width)
frames = []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    frames.append(cv2.cvtColor(cv2.resize(frame, (small_width, small_height)), cv2.COLOR_BGR2GRAY))
cap.release()
reference = frames[len(frames) // 2]
# Buildings dominate this mask; exclude fountain, traffic, and changing water.
mask = np.zeros_like(reference)
mask[:round(small_height * .47)] = 255
mask[:, :round(small_width * .10)] = 255
mask[round(small_height * .28):round(small_height * .61), round(small_width * .59):round(small_width * .97)] = 255
sift = cv2.SIFT_create(nfeatures=2200)
keypoints, descriptors = sift.detectAndCompute(reference, mask)
matcher = cv2.BFMatcher()
transforms, correspondences, inlier_counts = [], [], []
for index, frame in enumerate(frames):
    points, features = sift.detectAndCompute(frame, None)
    matches = [a for a, b in matcher.knnMatch(features, descriptors, k=2) if a.distance < .7 * b.distance]
    src = np.float32([points[m.queryIdx].pt for m in matches])
    dst = np.float32([keypoints[m.trainIdx].pt for m in matches])
    transform, inliers = cv2.findHomography(src, dst, cv2.RANSAC, 1.5)
    if transform is None or int(inliers.sum()) < 80:
        raise RuntimeError(f'Frame {index}: insufficient static background matches')
    transforms.append(transform)
    inlier_counts.append(int(inliers.sum()))
    correspondences.append((src[inliers[:, 0] == 1], dst[inliers[:, 0] == 1]))
# Fixed five-frame filter removes estimator jitter; it never changes playback time.
transforms = np.array(transforms)
padded = np.pad(transforms, ((2, 2), (0, 0), (0, 0)), mode='edge')
transforms = sum(weight * padded[i:i + len(frames)] for i, weight in enumerate([1/16, 4/16, 6/16, 4/16, 1/16]))
scale = np.diag([width / small_width, height / small_height, 1.])
valid = np.full((height, width), 255, np.uint8)
full_transforms, errors = [], []
for transform, (src, dst) in zip(transforms, correspondences):
    errors.append(float(np.median(np.linalg.norm(cv2.perspectiveTransform(src[:, None], transform)[:, 0] - dst, axis=1))) * width / small_width)
    transform = scale @ transform @ np.linalg.inv(scale)
    full_transforms.append(transform)
    valid &= cv2.warpPerspective(np.full((height, width), 255, np.uint8), transform, (width, height), flags=cv2.INTER_NEAREST)
if max(errors) > 2:
    raise RuntimeError(f'Background registration exceeds 2 pixels: {max(errors)}')
# One common crop for the entire clip: never animate the zoom or the framing.
for crop_width in range(width - 4, round(width * .6), -4):
    crop_height = round(crop_width * height / width)
    x, y = (width - crop_width) // 2, (height - crop_height) // 2
    if valid[y-2:y+crop_height+2, x-2:x+crop_width+2].min() == 255:
        break
else:
    raise RuntimeError('No sufficiently large common crop without black edges')
command = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{width}x{height}', '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '0', str(destination)]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
cap = cv2.VideoCapture(str(source))
try:
    for transform in full_transforms:
        ok, frame = cap.read()
        if not ok:
            raise RuntimeError('Source ended during stabilization')
        aligned = cv2.warpPerspective(frame, transform, (width, height), flags=cv2.INTER_CUBIC)
        aligned = cv2.resize(aligned[y:y+crop_height, x:x+crop_width], (width, height), interpolation=cv2.INTER_CUBIC)
        process.stdin.write(aligned.tobytes())
finally:
    cap.release()
    process.stdin.close()
    status = process.wait()
if status:
    raise RuntimeError(f'Video encoder exited with status {status}')
metadata.write_text(json.dumps({'method': 'static-background-homography', 'referenceFrame': len(frames) // 2,
    'minimumInliers': min(inlier_counts), 'maxRegistrationErrorPixels': max(errors),
    'fixedCrop': [x, y, crop_width, crop_height]}))
