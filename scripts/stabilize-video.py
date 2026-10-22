"""Register the intact shot with a similarity transform and one fixed crop.

Rotation, uniform scale and translation only: independent projective warps can
introduce a breathing/wobbling road. Scale/rotation estimates are filtered over
21 frames; the later monument pass supplies the final whole-frame translation.
"""
import json
from pathlib import Path
import subprocess
import sys

import cv2
import numpy as np

cv2.setNumThreads(2)
source,destination,metadata=map(Path,sys.argv[1:])
phase={'Pagi':'morning','Siang':'day','Sore':'evening','malam':'night'}[source.stem]
# Reference-frame coordinates measured in the original uploads. These identify
# solid statue/pillar material, excluding the fountain and moving traffic.
calibration={
 'morning':([70,39,1140,641],[636,210,50,110]),
 'day':([72,40,1136,639],[628,310,70,125]),
 'evening':([104,58,1072,603],[642,252,38,62]),
 'night':([352,198,1216,684],[630,345,65,125]),
}
cap=cv2.VideoCapture(str(source))
fps=cap.get(cv2.CAP_PROP_FPS)
width,height=int(cap.get(3)),int(cap.get(4))
frames=[]
while True:
 ok,frame=cap.read()
 if not ok:break
 frames.append(cv2.cvtColor(cv2.resize(frame,(640,360)),cv2.COLOR_BGR2GRAY))
cap.release()
if not frames:raise RuntimeError('No video frames')
reference=frames[len(frames)//2]
mask=np.zeros_like(reference)
mask[:169]=255
mask[:,:64]=255
mask[100:220,378:620]=255
sift=cv2.SIFT_create(nfeatures=2400)
keypoints,descriptors=sift.detectAndCompute(reference,mask)
matcher=cv2.BFMatcher()
transforms,errors,counts=[],[],[]
for index,frame in enumerate(frames):
 points,features=sift.detectAndCompute(frame,None)
 matches=[a for a,b in matcher.knnMatch(features,descriptors,k=2) if a.distance<.7*b.distance]
 src=np.float32([points[m.queryIdx].pt for m in matches])
 dst=np.float32([keypoints[m.trainIdx].pt for m in matches])
 transform,inliers=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=1.5,maxIters=3000,confidence=.999,refineIters=20)
 if transform is None or int(inliers.sum())<40:
  raise RuntimeError(f'Frame {index}: insufficient camera registration matches')
 transforms.append(transform)
 counts.append(int(inliers.sum()))
 selected=inliers[:,0]==1
 errors.append(float(np.median(np.linalg.norm(cv2.transform(src[selected,None],transform)[:,0]-dst[selected],axis=1)))*width/640)
transforms=np.array(transforms)
angles=np.unwrap(np.arctan2(transforms[:,1,0],transforms[:,0,0]))
scales=np.hypot(transforms[:,0,0],transforms[:,1,0])
weights=np.exp(-.5*(np.arange(-10,11)/5)**2)
weights/=weights.sum()
filtered=lambda a:np.convolve(np.pad(a,(10,10),mode='edge'),weights,mode='valid')
angles,scales=filtered(angles),filtered(scales)
transforms[:,0,0]=transforms[:,1,1]=scales*np.cos(angles)
transforms[:,1,0]=scales*np.sin(angles)
transforms[:,0,1]=-transforms[:,1,0]
# Keep the chosen reference frame exactly in its original coordinate system.
matrices=np.tile(np.eye(3),(len(frames),1,1))
matrices[:,:2]=transforms
reference_inverse=np.linalg.inv(matrices[len(frames)//2])
scale=np.diag([width/640,height/360,1.])
matrices=np.array([scale@reference_inverse@m@np.linalg.inv(scale) for m in matrices])
valid=np.full((height,width),255,np.uint8)
for matrix in matrices:
 valid &= cv2.warpAffine(np.full((height,width),255,np.uint8),matrix[:2],(width,height),flags=cv2.INTER_NEAREST)
for crop_width in range(width-8,round(width*.55),-4):
 crop_height=round(crop_width*height/width)
 x,y=(width-crop_width)//2,(height-crop_height)//2
 if valid[y-3:y+crop_height+3,x-3:x+crop_width+3].min()==255:break
else:raise RuntimeError('No sufficiently large common crop')
crop_matrix=np.array([[1280/crop_width,0,-x*1280/crop_width],[0,720/crop_height,-y*720/crop_height],[0,0,1.]])
command=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','0',str(destination)]
process=subprocess.Popen(command,stdin=subprocess.PIPE)
cap=cv2.VideoCapture(str(source))
try:
 for matrix in matrices:
  ok,frame=cap.read()
  if not ok:raise RuntimeError('Source ended during registration')
  aligned=cv2.warpAffine(frame,(crop_matrix@matrix)[:2],(1280,720),flags=cv2.INTER_LANCZOS4)
  process.stdin.write(aligned.tobytes())
finally:
 cap.release()
 process.stdin.close()
 status=process.wait()
if status:raise RuntimeError('Video encoder failed')
(old_x,old_y,old_w,old_h),(ax,ay,aw,ah)=calibration[phase]
box=[round((old_x+ax*old_w/1280-x)*1280/crop_width),round((old_y+ay*old_h/720-y)*720/crop_height),round(aw*old_w/crop_width),round(ah*old_h/crop_height)]
result={'method':'whole-frame-similarity','referenceFrame':len(frames)//2,'minimumInliers':min(counts),'maxRegistrationErrorPixels':max(errors),'fixedCrop':[x,y,crop_width,crop_height],'outputAnchorBox':box,'scaleRotationFilterFrames':21,'preservesStraightLines':True}
metadata.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result),flush=True)
