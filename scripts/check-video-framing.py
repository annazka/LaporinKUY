"""Audit accumulated scene drift against ONE reference, not adjacent frames.

Evening-specific architecture/foreground regions are in decoded 1280x720 pixels.
Independent reference-to-frame tracks expose a slow pullback which an adjacent
motion check can miss. Medians reject isolated vehicles; source parallax and
generative deformation can remain, so these are regional estimates, not a
guarantee that every pixel is fixed.
"""
import json
import sys

import cv2
import numpy as np

cv2.setNumThreads(2)
cap = cv2.VideoCapture(sys.argv[1])
frames = []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    if frame.shape[:2] != (720, 1280):
        raise RuntimeError('Framing audit requires decoded 1280x720 footage')
    frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
cap.release()
if not frames:
    raise RuntimeError('No video frames')
reference = frames[len(frames)//3]
regions = {
    'leftArchitecture': ((30, 30, 300, 260), .75),
    'rightArchitecture': ((940, 30, 300, 260), .75),
    'leftForeground': ((40, 510, 240, 180), 5.),
    'rightForeground': ((1010, 480, 230, 200), 5.),
}
result = {'checkedFrames': len(frames), 'referenceFrame': len(frames)//3,
          'measurementSpace': 'decoded 1280x720; direct reference-to-frame regional medians',
          'regions': {}}
for name, ((x, y, w, h), limit) in regions.items():
    mask = np.zeros_like(reference)
    mask[y:y+h, x:x+w] = 255
    points = cv2.goodFeaturesToTrack(reference, 200, .03, 7, mask=mask)
    if points is None or len(points) < 40:
        raise RuntimeError(f'{name}: insufficient static features')
    offsets, counts = [], []
    options = dict(winSize=(25, 25), maxLevel=3, criteria=(3, 60, .0001))
    for index, frame in enumerate(frames):
        moved, valid, _ = cv2.calcOpticalFlowPyrLK(reference, frame, points, None, **options)
        returned, back_valid, _ = cv2.calcOpticalFlowPyrLK(frame, reference, moved, None, **options)
        good = ((valid[:, 0] == 1) & (back_valid[:, 0] == 1)
                & (np.linalg.norm(returned[:, 0]-points[:, 0], axis=1) < .4))
        if good.sum() < 40:
            raise RuntimeError(f'{name}, frame {index}: insufficient reliable tracks')
        offsets.append(np.median(moved[good, 0]-points[good, 0], axis=0))
        counts.append(int(good.sum()))
    offsets = np.array(offsets)
    drift = np.linalg.norm(offsets, axis=1)
    result['regions'][name] = {
        'minimumTracks': min(counts), 'maximumMedianDriftPixels': float(drift.max()),
        'horizontalRangePixels': float(np.ptp(offsets[:, 0])),
        'verticalRangePixels': float(np.ptp(offsets[:, 1])),
        'loopJoinMedianDisplacementPixels': float(np.linalg.norm(offsets[0]-offsets[-1])),
        'limitPixels': limit,
    }
print(json.dumps(result, indent=2), flush=True)
