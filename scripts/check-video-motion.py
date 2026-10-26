"""Measure decoded static-building motion on the left, center and right.

Forward/backward optical flow rejects unreliable tracks. Region medians avoid
isolated moving signs/lights; the loop join is included. Values are estimates
in source video pixels, not proof of 0.01 px precision or absence of source
morphing. This intentionally checks peripheral motion beyond one monument ROI.
"""
import json
import sys

import cv2
import numpy as np

cv2.setNumThreads(2)
cap=cv2.VideoCapture(sys.argv[1])
width=cap.get(cv2.CAP_PROP_FRAME_WIDTH)
frames=[]
while True:
 ok,frame=cap.read()
 if not ok:break
 frames.append(cv2.cvtColor(cv2.resize(frame,(640,360)),cv2.COLOR_BGR2GRAY))
cap.release()
if not frames:raise RuntimeError('No video frames')
regions={'left':(10,10,205,140),'center':(220,10,225,95),'right':(455,10,175,150)}
measurements={name:[] for name in regions}
counts={name:[] for name in regions}
for index,current in enumerate(frames):
 previous=frames[index-1]
 for name,(x,y,w,h) in regions.items():
  mask=np.zeros_like(previous);mask[y:y+h,x:x+w]=255
  points=cv2.goodFeaturesToTrack(previous,160,.02,8,mask=mask)
  if points is None:raise RuntimeError(f'{name} {index}: no static features')
  moved,valid,_=cv2.calcOpticalFlowPyrLK(previous,current,points,None,winSize=(21,21),maxLevel=3,criteria=(3,40,.001))
  returned,back_valid,_=cv2.calcOpticalFlowPyrLK(current,previous,moved,None,winSize=(21,21),maxLevel=3,criteria=(3,40,.001))
  good=(valid[:,0]==1)&(back_valid[:,0]==1)&(np.linalg.norm(returned[:,0]-points[:,0],axis=1)<.4)
  if good.sum()<16:raise RuntimeError(f'{name} {index}: insufficient reliable static features: {good.sum()}')
  motion=np.median(moved[good,0]-points[good,0],axis=0)*width/640
  measurements[name].append(motion)
  counts[name].append(int(good.sum()))
result={'checkedFrames':len(frames),'regions':{}}
for name,vectors in measurements.items():
 vectors=np.array(vectors)
 steps=np.linalg.norm(vectors,axis=1)
 result['regions'][name]={'minimumTracks':min(counts[name]),'maximumMedianStepPixels':float(steps.max()),'p95MedianStepPixels':float(np.percentile(steps,95)),'medianStepPixels':float(np.median(steps)),'worstFrame':int(steps.argmax()),'loopJoinMedianStepPixels':float(steps[0])}
left,right=np.array(measurements['left']),np.array(measurements['right'])
disagreement=np.linalg.norm(left-right,axis=1)
result['maximumEdgeDisagreementPixels']=float(disagreement.max())
result['p95EdgeDisagreementPixels']=float(np.percentile(disagreement,95))
result['worstEdgeFrame']=int(disagreement.argmax())
print(json.dumps(result,indent=2),flush=True)
