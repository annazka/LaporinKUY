"""Lock the monument/architecture to a reference plate, retain live roads/water.

Usage: python3 scripts/lock-video-background.py INPUT OUTPUT PHASE METRICS.json
Input is an already aligned cyclic loop. No time remapping, zoom, interpolation,
or per-frame perspective correction is performed here. Masks are authored for
our four 1280x720 exports, not arbitrary footage.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import cv2
import numpy as np

cv2.setNumThreads(2)
source, destination = map(Path, sys.argv[1:3])
phase, metrics_path = sys.argv[3], Path(sys.argv[4])
if source.resolve()==destination.resolve():raise ValueError('Input and output must differ')
# Actual visible monument bounding boxes, including its base. All stay fixed.
settings = {
 'morning': {'anchor':(605,185,125,255),'pool':(655,385,305,100),'road':[(400,720),(505,432),(815,430),(975,720)],'side':[(930,420),(1280,465),(1280,610),(975,500)]},
 'day': {'anchor':(600,290,130,275),'pool':(650,487,315,100),'road':[(390,720),(490,535),(815,530),(980,720)],'side':[(1000,510),(1280,555),(1280,700),(1000,585)]},
 'evening': {'anchor':(600,225,135,285),'pool':(660,432,315,100),'road':[(390,720),(510,480),(825,475),(990,720)],'side':[(950,465),(1280,510),(1280,650),(980,545)]},
 'night': {'anchor':(590,310,165,300),'pool':(670,545,360,115),'road':[(280,720),(440,610),(880,610),(1090,720)],'side':[(1000,565),(1280,605),(1280,720),(1020,665)]},
}
config=settings[phase]
cap=cv2.VideoCapture(str(source))
fps=cap.get(cv2.CAP_PROP_FPS)
ok,plate=cap.read()
if not ok or plate.shape[:2]!=(720,1280):raise RuntimeError('Expected decoded 1280x720 loop')
height,width=plate.shape[:2]
source_frames=round(cap.get(cv2.CAP_PROP_FRAME_COUNT))
mask=np.zeros((height,width),np.uint8)
cx,cy,rx,ry=config['pool']
cv2.ellipse(mask,(cx,cy),(rx,ry),0,0,360,255,-1)
for points in [config['road'],config['side']]:cv2.fillPoly(mask,[np.array(points,np.int32)],255)
x,y,w,h=config['anchor']
# Feather only the boundary between moving footage and the reference plate.
protect=np.zeros_like(mask)
cv2.rectangle(protect,(x-18,y-18),(x+w+18,y+h+18),255,-1)
alpha=cv2.GaussianBlur(mask.astype(np.float32)/255,(0,0),7)
alpha*=1-cv2.GaussianBlur(protect.astype(np.float32)/255,(0,0),7)
alpha[y:y+h,x:x+w]=0
alpha=alpha[:,:,None]
command=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','bgr24','-s',f'{width}x{height}','-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','2','-preset','medium','-qp','18','-x264-params','ipratio=1:pbratio=1:aq-mode=0','-g',str(source_frames),'-keyint_min',str(source_frames),'-sc_threshold','0','-pix_fmt','yuv420p','-movflags','+faststart',str(destination)]
encoder=subprocess.Popen(command,stdin=subprocess.PIPE)
count=0
try:
 frame=plate
 while True:
  result=np.clip(plate.astype(np.float32)*(1-alpha)+frame.astype(np.float32)*alpha,0,255).astype(np.uint8)
  encoder.stdin.write(result.tobytes());count+=1
  ok,frame=cap.read()
  if not ok:break
finally:
 cap.release();encoder.stdin.close();status=encoder.wait()
if status:raise RuntimeError('Encoding failed')
# Verify decoded output, including the seam. Check actual monument, not a median
# over unrelated buildings; require motion to remain in the traffic region.
cap=cv2.VideoCapture(str(destination));ok,first=cap.read()
ref=cv2.cvtColor(first,cv2.COLOR_BGR2GRAY)
roi=np.zeros_like(ref);roi[y:y+h,x:x+w]=255
points=cv2.goodFeaturesToTrack(ref,100,.02,5,mask=roi)
if points is None or len(points)<10:raise RuntimeError('Insufficient monument features for verification')
max_drift=0.;max_change=0.;motion=[];previous=ref;decoded=1
traffic=(alpha[:,:,0]>.98)
while True:
 ok,frame=cap.read()
 if not ok:break
 gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
 tracked,valid,_=cv2.calcOpticalFlowPyrLK(ref,gray,points,None,winSize=(21,21),maxLevel=2)
 usable=valid[:,0]>0
 if usable.sum()<10:raise RuntimeError('Monument tracking lost during verification')
 max_drift=max(max_drift,float(np.median(np.linalg.norm(tracked[usable,0]-points[usable,0],axis=1))))
 max_change=max(max_change,float(np.abs(gray[y:y+h,x:x+w].astype(np.float32)-ref[y:y+h,x:x+w]).mean()))
 motion.append(float(np.abs(gray.astype(np.float32)-previous)[traffic].mean()))
 previous=gray;decoded+=1
cap.release()
record={'method':'fixed reference plate; feathered live traffic and fountain','inputSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'anchorBox':config['anchor'],'checkedFrames':decoded,'maxMonumentDisplacementPixels':max_drift,'maxMonumentMeanPixelChange':max_change,'medianTrafficFrameDifference':float(np.median(motion)),'liveAreaFraction':float((alpha[:,:,0]>.5).mean())}
if decoded!=count or max_drift>.05 or max_change>.1 or np.median(motion)<.2:
 raise RuntimeError(f'Anchor lock verification failed: {record}')
metrics_path.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record),flush=True)
