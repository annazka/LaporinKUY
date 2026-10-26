"""Measure decoded monument motion, including independent upper/lower regions.

A small translation of one patch does not prove the entire object is stable.
Use --limit 0.01 to audit the user's requested precision separately from the
normal export sanity check. All values are estimates in 1280x720 video pixels,
not a guarantee about every pixel after browser scaling or source deformation.
"""
import argparse
from importlib.util import spec_from_file_location,module_from_spec
import json
import sys

import cv2
import numpy as np

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('video')
parser.add_argument('box',type=json.loads)
parser.add_argument('--limit',type=float,default=.5)
args=parser.parse_args()
sys.dont_write_bytecode=True
spec=spec_from_file_location('anchor','scripts/anchor-video-monument.py')
anchor=module_from_spec(spec)
spec.loader.exec_module(anchor)
cap=cv2.VideoCapture(args.video)
frames=[]
while True:
 ok,frame=cap.read()
 if not ok:break
 frames.append(cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY))
cap.release()
if not frames:raise RuntimeError('No decoded frames')
x,y,w,h=args.box
boxes=[args.box,[x,y,w,h//2],[x,y+h//2,w,h-h//2]]
reference=frames[len(frames)//3]
measurements=[[anchor.measure(reference,frame,box) for box in boxes] for frame in frames]
scores=np.array([[m[0] for m in row] for row in measurements])
vectors=np.array([[m[1] for m in row] for row in measurements])
offsets=vectors[:,0]
drift=np.linalg.norm(offsets,axis=1)
steps=np.linalg.norm(offsets-np.roll(offsets,1,axis=0),axis=1)
regional=np.linalg.norm(vectors[:,1:],axis=2)
differential=np.linalg.norm(vectors[:,1]-vectors[:,2],axis=1)
requested=.01
maximum=max(float(drift.max()),float(regional.max()))
result={'checkedFrames':len(frames),'minimumCorrelation':float(scores.min()),'maxMonumentDisplacementPixels':float(drift.max()),'maximumAdjacentDisplacementPixels':float(steps.max()),'loopJoinDisplacementPixels':float(np.linalg.norm(offsets[0]-offsets[-1])),'maximumRegionalDisplacementPixels':float(regional.max()),'maximumInterRegionDisplacementPixels':float(differential.max()),'worstFrame':int(drift.argmax()),'requestedMaximumPixels':requested,'requestedTargetMet':maximum<=requested,'measurementSpace':'decoded 1280x720 video; whole anchor and independent upper/lower patches'}
print(json.dumps(result),flush=True)
# The export camera check and the user's exact 0.01 px audit are distinct.
# Regional shape changes remain reported, including when camera motion passes.
if scores.min()<.65 or drift.max()>args.limit or steps.max()>args.limit or (args.limit<=.01 and maximum>args.limit):
 raise RuntimeError(f'Measured monument motion exceeds {args.limit} pixels: {maximum}')
