"""Estimate shape changes in four visible edge regions against one reference.

Track static architecture/roofs, fit a similarity per region, and report the
remaining non-rigid displacement. This diagnostic never transforms the video.
Sample every fourth frame plus the loop endpoint. Source parallax, generative
deformation and tracking noise can remain: these are estimates, not a claim
that all source geometry is perfect.
"""
import json
import sys

import cv2
import numpy as np

cv2.setNumThreads(2)
cap=cv2.VideoCapture(sys.argv[1])
frames=[]
while True:
    ok,frame=cap.read()
    if not ok:break
    frames.append(cv2.cvtColor(cv2.resize(frame,(640,360)),cv2.COLOR_BGR2GRAY))
cap.release()
if not frames:raise RuntimeError('No decoded frames')
reference=frames[len(frames)//3]
indices=sorted(set([*range(0,len(frames),4),len(frames)-1]))
regions={'left':(4,5,135,235),'right':(510,5,125,235),
         'lowerLeft':(4,250,180,105),'lowerRight':(505,245,130,110)}
result={'decodedFrames':len(frames),'sampledFrames':len(indices),
        'measurementSpace':'1280x720 pixel equivalents; 90th percentile regional non-rigid residual',
        'regions':{}}
options=dict(winSize=(21,21),maxLevel=3,criteria=(3,40,.001))
for name,(x,y,w,h) in regions.items():
    mask=np.zeros_like(reference);mask[y:y+h,x:x+w]=255
    points=cv2.goodFeaturesToTrack(reference,120,.03,6,mask=mask)
    if points is None or len(points)<20:raise RuntimeError(f'{name}: insufficient landmarks')
    residuals=[];counts=[]
    for index in indices:
        moved,valid,_=cv2.calcOpticalFlowPyrLK(reference,frames[index],points,None,**options)
        returned,back_valid,_=cv2.calcOpticalFlowPyrLK(frames[index],reference,moved,None,**options)
        good=((valid[:,0]==1)&(back_valid[:,0]==1)
              &(np.linalg.norm(returned[:,0]-points[:,0],axis=1)<.4))
        if good.sum()<20:raise RuntimeError(f'{name}, frame {index}: unreliable tracks')
        src,dst=points[good,0],moved[good,0]
        # Fit all reliable tracks with a robust loss. RANSAC can choose a tiny
        # patch during a distorted dissolve and reject most of the architecture
        # whose changing shape this diagnostic is intended to measure.
        origin=np.mean(src,axis=0);centered=src-origin
        design=np.zeros((len(src)*2,4),dtype=np.float64)
        design[::2,0]=centered[:,0];design[::2,1]=-centered[:,1];design[::2,2]=1
        design[1::2,0]=centered[:,1];design[1::2,1]=centered[:,0];design[1::2,3]=1
        weights=np.ones(len(src))
        for _ in range(12):
            expanded=np.repeat(np.sqrt(weights),2)
            fitted=np.linalg.lstsq(design*expanded[:,None],dst.reshape(-1)*expanded,rcond=None)[0]
            delta=dst-(design@fitted).reshape(-1,2)
            weights=np.minimum(1,.75/np.maximum(np.linalg.norm(delta,axis=1),1e-6))
        residuals.append(float(np.percentile(np.linalg.norm(delta,axis=1),90))*2)
        counts.append(int(good.sum()))
    result['regions'][name]={'minimumTracks':min(counts),
        'p95ShapeResidualPixels':float(np.percentile(residuals,95)),
        'maximumShapeResidualPixels':max(residuals)}
result['worstRegionP95Pixels']=max(r['p95ShapeResidualPixels'] for r in result['regions'].values())
result['meanRegionP95Pixels']=float(np.mean([r['p95ShapeResidualPixels'] for r in result['regions'].values()]))
print(json.dumps(result,indent=2),flush=True)
