"""Lock the monument with ONE translation of each complete video frame.

Run after coarse camera registration. No object extraction, static plates, local
warps, or replacement pixels: traffic and water remain the original footage.
Coordinates refer to the 1280x720 coarse-registered reference shot.
"""
import json
from pathlib import Path
import subprocess
import sys

import cv2
import numpy as np

cv2.setNumThreads(2)
BOXES = {
    'morning': (636, 210, 50, 110),
    'day': (628, 310, 70, 125),
    'evening': (642, 252, 38, 62),
    'night': (630, 345, 65, 125),
}

def measure(reference, frame, box):
    x, y, w, h = box
    padding=24
    left,top=max(0,x-padding),max(0,y-padding)
    patch=frame[top:min(frame.shape[0],y+h+padding),left:min(frame.shape[1],x+w+padding)]
    template=reference[y:y+h,x:x+w]
    matches=cv2.matchTemplate(patch,template,cv2.TM_CCOEFF_NORMED)
    _,_,_,location=cv2.minMaxLoc(matches)
    transform=np.eye(2,3,dtype=np.float32)
    transform[:,2]=location
    score, transform=cv2.findTransformECC(
        template,patch,transform,cv2.MOTION_TRANSLATION,
        (cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,150,.0000001),None,3)
    return float(score), transform[:,2]-[x-left,y-top]

if __name__ == '__main__':
    source, destination, phase, metadata = sys.argv[1:5]
    box = tuple(json.loads(sys.argv[5])) if len(sys.argv)>5 else BOXES[phase]
    cap = cv2.VideoCapture(source)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(cv2.cvtColor(cv2.resize(frame, (1280, 720)), cv2.COLOR_BGR2GRAY))
    cap.release()
    reference = frames[len(frames)//2]
    scores, offsets = zip(*(measure(reference, frame, box) for frame in frames))
    offsets = np.array(offsets)
    if min(scores) < .65 or np.abs(offsets).max() > 20:
        raise RuntimeError(f'{phase}: monument registration is unreliable: {min(scores)}, {np.abs(offsets).max()}')
    # One fixed crop for all frames; never zoom/shift individual scene regions.
    margin = int(np.ceil(max(np.abs(offsets[:,0]).max()+3, (np.abs(offsets[:,1]).max()+3)*1280/720)))
    # Fixed 4% overscan trims the outer source border throughout the clip.
    # No mirrored/stretch-filled edges and no animated crop.
    maximum_correction=float(np.linalg.norm(offsets,axis=1).max())
    margin = max(margin,52,int(np.ceil((maximum_correction+4)*1280/720)))
    crop_width = 1280 - 2*margin
    crop_height = round(crop_width*720/1280)
    left, top = (1280-crop_width)//2, (720-crop_height)//2
    command = ['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','0',destination]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    cap = cv2.VideoCapture(source)
    for offset in offsets:
        ok, frame = cap.read()
        if not ok:
            raise RuntimeError('Source ended during monument registration')
        frame = cv2.resize(frame,(1280,720))
        matrix = np.eye(2,3,dtype=np.float32)
        matrix[:,2] = -offset
        frame = cv2.warpAffine(frame,matrix,(1280,720),flags=cv2.INTER_LANCZOS4)
        frame = cv2.resize(frame[top:top+crop_height,left:left+crop_width],(1280,720),interpolation=cv2.INTER_LANCZOS4)
        process.stdin.write(frame.tobytes())
    cap.release()
    process.stdin.close()
    if process.wait():
        raise RuntimeError('Video encoder failed')
    x,y,w,h=box
    output_box=[round((x-left)*1280/crop_width),round((y-top)*720/crop_height),round(w*1280/crop_width),round(h*720/crop_height)]
    result={'method':'whole-frame-monument-translation','checkedFrames':len(frames),'referenceFrame':len(frames)//2,'minimumCorrelation':min(scores),'maximumCorrectionPixels':float(np.linalg.norm(offsets,axis=1).max()),'fixedCrop':[left,top,crop_width,crop_height],'outputAnchorBox':output_box,'preservesWholeFrames':True,'requestedTargetPixels':.01,'edgeMode':'fixed-crop-no-fill','conservativeEdgeClearancePixels':min(left,top,1280-left-crop_width,720-top-crop_height)-maximum_correction}
    Path(metadata).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result),flush=True)
