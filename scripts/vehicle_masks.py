"""Local COCO vehicle/person instance masks for offline background compositing."""
from pathlib import Path
import cv2
import numpy as np

class VehicleMasks:
 def __init__(self,model):
  self.network=cv2.dnn.readNetFromONNX(str(model))
 def detect(self,frame):
  h,w=frame.shape[:2];scale=640/max(h,w);rw,rh=round(w*scale),round(h*scale)
  image=np.full((640,640,3),114,np.uint8);left,top=(640-rw)//2,(640-rh)//2
  image[top:top+rh,left:left+rw]=cv2.resize(frame,(rw,rh))
  self.network.setInput(cv2.dnn.blobFromImage(image,1/255.,(640,640),swapRB=True))
  outputs=self.network.forward(self.network.getUnconnectedOutLayersNames())
  pred=next(x for x in outputs if x.ndim==3)[0].T
  proto=next(x for x in outputs if x.ndim==4)[0]
  classes=pred[:,4:84].argmax(axis=1);scores=pred[:,4:84].max(axis=1)
  keep=(scores>.16)&np.isin(classes,[0,1,2,3,5,7])
  pred,scores,classes=pred[keep],scores[keep],classes[keep]
  boxes=np.column_stack((pred[:,0]-pred[:,2]/2,pred[:,1]-pred[:,3]/2,pred[:,2],pred[:,3]))
  selected=cv2.dnn.NMSBoxes(boxes.tolist(),scores.tolist(),.16,.45)
  mask=np.zeros((h,w),np.uint8);count=0
  for index in np.asarray(selected).reshape(-1):
   box=boxes[index];x1,y1=np.round([(box[0]-left)/scale,(box[1]-top)/scale]).astype(int);x2,y2=np.round([(box[0]+box[2]-left)/scale,(box[1]+box[3]-top)/scale]).astype(int)
   x1,x2=np.clip([x1,x2],0,w);y1,y2=np.clip([y1,y2],0,h)
   if x2<=x1 or y2<=y1:continue
   logits=(pred[index,84:]@proto.reshape(32,-1)).reshape(proto.shape[1:])
   probabilities=1/(1+np.exp(-np.clip(logits,-30,30)))
   probabilities=cv2.resize(probabilities,(640,640))[top:top+rh,left:left+rw]
   probabilities=cv2.resize(probabilities,(w,h))
   region=(probabilities[y1:y2,x1:x2]>.4).astype(np.uint8)*255
   mask[y1:y2,x1:x2]=np.maximum(mask[y1:y2,x1:x2],region);count+=1
  return cv2.dilate(mask,np.ones((3,3),np.uint8)),count
