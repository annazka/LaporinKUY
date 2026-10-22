"""Offline object compositing: fixed architecture AND road, moving vehicles/water.

Input is an aligned cyclic loop. Vehicle masks run locally; no frames leave this
machine. Set LAPORKUY_SEGMENTATION_MODEL to the COCO YOLOv8n-seg ONNX file.
Only individual vehicle silhouettes and the inside of the fountain are live.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import warnings
import cv2
import numpy as np
from vehicle_masks import VehicleMasks

cv2.setNumThreads(1)
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('source',type=Path);p.add_argument('destination',type=Path)
p.add_argument('phase',choices=['morning','day','evening','night']);p.add_argument('metrics',type=Path)
p.add_argument('--model',type=Path,default=os.environ.get('LAPORKUY_SEGMENTATION_MODEL','artifacts/models/yolov8n-seg.onnx'))
args=p.parse_args();source,destination,phase=args.source,args.destination,args.phase
if source.resolve()==destination.resolve():raise ValueError('Input and output must differ')
if not args.model.exists():raise RuntimeError('Set LAPORKUY_SEGMENTATION_MODEL to a local YOLOv8n-seg ONNX model')
settings={
 'morning':{'anchor':(605,185,125,255),'pool':(655,385,305,100),'water':(655,369,185,35),'road':[(400,720),(505,432),(815,430),(975,720)],'side':[(930,420),(1280,465),(1280,610),(975,500)]},
 'day':{'anchor':(600,290,130,275),'pool':(650,487,315,100),'water':(650,483,185,35),'road':[(390,720),(490,535),(815,530),(980,720)],'side':[(1000,510),(1280,555),(1280,700),(1000,585)]},
 'evening':{'anchor':(600,225,135,285),'pool':(660,432,315,100),'water':(660,421,185,38),'road':[(390,720),(510,480),(825,475),(990,720)],'side':[(950,465),(1280,510),(1280,650),(980,545)]},
 'night':{'anchor':(590,310,165,300),'pool':(670,545,360,115),'water':(670,525,230,35),'road':[(280,720),(440,610),(880,610),(1090,720)],'side':[(1000,565),(1280,605),(1280,720),(1020,665)]},
};config=settings[phase]
source_hash=hashlib.sha256(source.read_bytes()).hexdigest();model_hash=hashlib.sha256(args.model.read_bytes()).hexdigest()
cache=Path(tempfile.gettempdir())/'laporkuy-object-masks'/f'{phase}-{source_hash[:12]}-{model_hash[:8]}-v1';cache.mkdir(parents=True,exist_ok=True)
cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS);count=round(cap.get(cv2.CAP_PROP_FRAME_COUNT));ok,plate=cap.read()
if not ok or plate.shape[:2]!=(720,1280):raise RuntimeError('Expected a 1280x720 loop')
h,w=plate.shape[:2];road=np.zeros((h,w),np.uint8)
cx,cy,rx,ry=config['pool'];cv2.ellipse(road,(cx,cy),(rx,ry),0,0,360,255,-1)
for polygon in [config['road'],config['side']]:cv2.fillPoly(road,[np.array(polygon,np.int32)],255)
x,y,aw,ah=config['anchor'];road[y:y+ah,x:x+aw]=0
# Median/curb islands can resemble a bus from above, especially at night. These
# physically impassable road structures are explicit negative object regions.
islands={
 'morning':[(618,450),(680,450),(734,720),(590,720)],
 'day':[(618,565),(680,565),(716,720),(590,720)],
 'evening':[(620,510),(682,510),(734,720),(590,720)],
 'night':[(620,615),(710,615),(756,720),(590,720)],
}
island=np.zeros_like(road);cv2.fillPoly(island,[np.array(islands[phase],np.int32)],255)
road[island>0]=0
def object_mask(mask):
 mask=mask.copy()
 n,labels,stats,_=cv2.connectedComponentsWithStats(mask)
 for label in range(1,n):
  _,_,bw,bh,_=stats[label]
  # No vehicle in these distant shots is both this broad and tall. This
  # rejects lit basin walls falsely classified as buses, not the road layer.
  if bw>85 and bh>70:mask[labels==label]=0
 return cv2.bitwise_and(mask,road)
water=np.zeros_like(road);cx,cy,rx,ry=config['water'];cv2.ellipse(water,(cx,cy),(rx,ry),0,0,360,255,-1)
# Erode the pool interior: neither the basin rim nor street is moving water.
water=cv2.GaussianBlur(water.astype(np.float32)/255,(0,0),2)
water[y-5:y+ah+5,x-5:x+aw+5]=0
sample_indices=set(np.linspace(0,count-1,min(45,count),dtype=int).tolist())
samples=[];sample_masks=[];ever_vehicles=np.zeros_like(road);vehicle_pixels=[];network=None
cap.set(cv2.CAP_PROP_POS_FRAMES,0)
for i in range(count):
 ok,frame=cap.read()
 if not ok:raise RuntimeError('Truncated input')
 mask_path=cache/f'{i:04}.png'
 if mask_path.exists():mask=cv2.imread(str(mask_path),0)
 else:
  if network is None:network=VehicleMasks(args.model)
  mask,_=network.detect(frame)
  # A second, full-resolution view catches small vehicles missed by the full
  # shot. It overlays object silhouettes, never a rectangular road video layer.
  detail,_=network.detect(frame[240:720,320:960])
  mask[240:720,320:960]=np.maximum(mask[240:720,320:960],detail)
  cv2.imwrite(str(mask_path),mask)
 mask=object_mask(mask)
 ever_vehicles|=mask;vehicle_pixels.append(int((mask>0).sum()))
 if i in sample_indices:samples.append(frame);sample_masks.append(mask)
 if i%60==0:print(phase,'segmented',i,'/',count,flush=True)
cap.release()
# A masked temporal median removes cars from the road plate. Otherwise a car
# from the reference frame would remain parked behind a moving extracted car.
clean=plate.copy();sample_stack=np.stack(samples)
mask_stack=np.stack(sample_masks)>0
for row in range(0,h,32):
 values=sample_stack[:,row:row+32].astype(np.float32)
 invalid=mask_stack[:,row:row+32]
 values=np.where(invalid[:,:,:,None],np.nan,values)
 with warnings.catch_warnings():
  warnings.simplefilter('ignore',RuntimeWarning);median=np.nanmedian(values,axis=0)
 fallback=np.median(sample_stack[:,row:row+32],axis=0)
 median=np.where(np.isnan(median),fallback,median).astype(np.uint8)
 # Preserve the reference road's crisp paint/curbs. Replace only vehicle
 # footprints visited by detected vehicles, rather than averaging the
 # entire road surface (which would smear markings and distant texture).
 # Including the complete track also clears reference cars missed on frame 0.
 selected=cv2.dilate(ever_vehicles,np.ones((5,5),np.uint8))[row:row+32]>0
 clean[row:row+32][selected]=median[selected]
# Test immutable road texture across the ENTIRE loop. Exclude every vehicle
# footprint plus a codec margin, and all live water, from the road anchors.
ever_dynamic=cv2.dilate(ever_vehicles,np.ones((19,19),np.uint8))
ever_dynamic[water>.001]=255
static_road=((road>0)|(island>0))&(ever_dynamic==0)
if static_road.sum()<5000:raise RuntimeError('Insufficient permanent road anchors')
cv2.imwrite(str(cache/'road-plate.jpg'),clean)
cv2.imwrite(str(cache/'static-road-mask.png'),static_road.astype(np.uint8)*255)
command=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','1','-preset','medium','-qp','18','-x264-params','ipratio=1:pbratio=1:aq-mode=0','-g',str(count),'-keyint_min',str(count),'-sc_threshold','0','-pix_fmt','yuv420p','-movflags','+faststart',str(destination)]
encoder=subprocess.Popen(command,stdin=subprocess.PIPE);cap=cv2.VideoCapture(str(source))
try:
 for i in range(count):
  ok,frame=cap.read()
  if not ok:raise RuntimeError('Truncated input during composition')
  mask=object_mask(cv2.imread(str(cache/f'{i:04}.png'),0))
  alpha=np.maximum(cv2.GaussianBlur(mask.astype(np.float32)/255,(0,0),.8),water)
  alpha[y:y+ah,x:x+aw]=0
  result=np.clip(clean.astype(np.float32)*(1-alpha[:,:,None])+frame.astype(np.float32)*alpha[:,:,None],0,255).astype(np.uint8)
  encoder.stdin.write(result.tobytes())
finally:
 cap.release();encoder.stdin.close();status=encoder.wait()
if status:raise RuntimeError('Encoding failed')
cap=cv2.VideoCapture(str(destination));ok,first=cap.read();ref=cv2.cvtColor(first,cv2.COLOR_BGR2GRAY)
anchor_mask=np.zeros_like(ref);anchor_mask[y:y+ah,x:x+aw]=255
monument_points=cv2.goodFeaturesToTrack(ref,100,.02,5,mask=anchor_mask)
road_points=cv2.goodFeaturesToTrack(ref,200,.02,5,mask=static_road.astype(np.uint8)*255)
if monument_points is None or road_points is None or len(road_points)<10:raise RuntimeError('Insufficient validation features')
def drift(gray,points):
 tracked,valid,_=cv2.calcOpticalFlowPyrLK(ref,gray,points,None,winSize=(15,15),maxLevel=1)
 if valid[:,0].sum()<10:raise RuntimeError('Anchor tracking lost')
 return float(np.median(np.linalg.norm(tracked[valid[:,0]>0,0]-points[valid[:,0]>0,0],axis=1)))
max_monument=max_road=monument_change=road_change=0.;motion=[];previous=ref;decoded=1
while True:
 ok,frame=cap.read()
 if not ok:break
 gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY);delta=np.abs(gray.astype(np.float32)-ref)
 max_monument=max(max_monument,drift(gray,monument_points));max_road=max(max_road,drift(gray,road_points))
 monument_change=max(monument_change,float(delta[y:y+ah,x:x+aw].mean()));road_change=max(road_change,float(delta[static_road].mean()))
 mask=object_mask(cv2.imread(str(cache/f'{decoded:04}.png'),0))>0
 motion.append(float(np.abs(gray.astype(np.float32)-previous)[mask].mean()) if mask.any() else 0.)
 previous=gray;decoded+=1
cap.release()
record={'method':'fixed road/architecture plate; local instance-segmented vehicles; fountain interior only','inputSha256':source_hash,'modelSha256':model_hash,'anchorBox':config['anchor'],'checkedFrames':decoded,'maxMonumentDisplacementPixels':max_monument,'maxMonumentMeanPixelChange':monument_change,'maxRoadDisplacementPixels':max_road,'maxRoadMeanPixelChange':road_change,'staticRoadPixelCount':int(static_road.sum()),'medianVehiclePixels':float(np.median(vehicle_pixels)),'medianTrafficFrameDifference':float(np.median(motion)),'liveAreaFraction':float(np.median(vehicle_pixels)/(h*w))}
if decoded!=count or max_monument>.05 or monument_change>.1 or max_road>.1 or road_change>.2 or np.median(motion)<.2 or np.median(vehicle_pixels)<500:
 raise RuntimeError(f'Object/road verification failed: {record}')
args.metrics.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record),flush=True)
