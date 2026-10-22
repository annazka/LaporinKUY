"""Measure the monument in every final decoded frame, including the loop join."""
import json
import sys

import cv2
import numpy as np
from importlib.util import spec_from_file_location, module_from_spec

sys.dont_write_bytecode=True
spec=spec_from_file_location('anchor','scripts/anchor-video-monument.py')
anchor=module_from_spec(spec)
spec.loader.exec_module(anchor)
cap=cv2.VideoCapture(sys.argv[1])
frames=[]
while True:
    ok,frame=cap.read()
    if not ok: break
    frames.append(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY))
cap.release()
box=json.loads(sys.argv[2])
reference=frames[len(frames)//3]
scores,offsets=zip(*(anchor.measure(reference,frame,box) for frame in frames))
offsets=np.array(offsets)
drift=np.linalg.norm(offsets,axis=1)
steps=np.linalg.norm(offsets-np.roll(offsets,1,axis=0),axis=1)
result={'checkedFrames':len(frames),'minimumCorrelation':min(scores),'maxMonumentDisplacementPixels':float(drift.max()),'maximumAdjacentDisplacementPixels':float(steps.max()),'loopJoinDisplacementPixels':float(np.linalg.norm(offsets[0]-offsets[-1])),'worstFrame':int(drift.argmax())}
print(json.dumps(result),flush=True)
if min(scores)<.65 or drift.max()>1.5 or steps.max()>1.5:
    raise RuntimeError(f'Monument alignment is not stable: {result}')
