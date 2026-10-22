"""Prepare the four named uploads as stabilized, forward-playing cyclic loops.

PYTHONPATH=/path/to/video-tools python3 scripts/prepare-backgrounds.py --sources /path/to/unzipped/videos
Requires ffmpeg and scripts/video-requirements.txt. Originals stay outside public/.
Pass --stabilized DIR to reuse explicitly prepared PHASE-stable.mp4 and
PHASE-registration.json files. No repeated short snippets or reverse playback.
"""
import argparse
import hashlib
import fcntl
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sources', type=Path, required=True)
parser.add_argument('--stabilized', type=Path)
parser.add_argument('--output',type=Path,default=Path('public/media/phases'))
parser.add_argument('--manifest',type=Path,default=Path('tests/fixtures/video-loop-metrics.json'))
parser.add_argument('--phase', choices=['morning','day','evening','night'])
args = parser.parse_args()
output = args.output
output.mkdir(parents=True, exist_ok=True)
names = {'morning':'Pagi.mp4','day':'Siang.mp4','evening':'Sore.mp4','night':'malam.mp4'}
manifest_path = args.manifest
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
manifest = {'method':'intact forward footage; filtered similarity camera correction and whole-frame monument anchoring; cyclic 3-second smoothstep overlap', 'phases':manifest.get('phases',{})}

def run(*command):
    subprocess.run(list(map(str,command)), check=True)

def luma(path):
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-vf','scale=160:90','-f','rawvideo','-pix_fmt','gray','-'])
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1,90,160).astype(np.float32)

with tempfile.TemporaryDirectory(prefix='laporkuy-loop-') as temporary:
    work = Path(temporary)
    for phase, name in names.items():
        if args.phase and args.phase != phase:
            continue
        source = args.sources / name
        stable = (args.stabilized or work) / f'{phase}-stable.mp4'
        registration = stable.with_name(f'{phase}-registration.json')
        if not args.stabilized:
            run(sys.executable,'scripts/stabilize-video.py',source,stable,registration)
        anchored=work/f'{phase}-monument.mp4'
        anchor_metadata=work/f'{phase}-monument.json'
        registration_data=json.loads(registration.read_text())
        if registration_data.get('method')!='whole-frame-similarity':
            raise RuntimeError('Reuse only similarity-registered clips; projective warps are not allowed')
        box=registration_data.get('outputAnchorBox')
        extra=[json.dumps(box)] if box else []
        run(sys.executable,'scripts/anchor-video-monument.py',stable,anchored,phase,anchor_metadata,*extra)
        anchor=json.loads(anchor_metadata.read_text())
        stable=anchored
        details=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=r_frame_rate,nb_frames','-of','json',str(stable)]))['streams'][0]
        numerator,denominator=map(int,details['r_frame_rate'].split('/'))
        fps=numerator/denominator
        frames=int(details['nb_frames'])
        fade=round(3*fps)
        if frames < fade*2+fps:
            raise RuntimeError('Need at least seven seconds of continuous source footage')
        t=f'clip(T/{(fade-1)/fps},0,1)'
        weight=f'({t})*({t})*(3-2*({t}))'
        graph=(f'[0:v]scale=1280:720,setsar=1,split=3[h][m][t];'
            f'[h]trim=end_frame={fade},settb=1/{fps},setpts=N[head];'
            f'[m]trim=start_frame={fade}:end_frame={frames-fade},settb=1/{fps},setpts=N[middle];'
            f'[t]trim=start_frame={frames-fade},settb=1/{fps},setpts=N[tail];'
            f"[tail][head]blend=all_expr='A*(1-({weight}))+B*({weight})':shortest=1[bridge];"
            f'[middle][bridge]concat=n=2:v=1:a=0,format=yuv420p[out]')
        destination=work/f'{phase}.mp4'
        run('ffmpeg','-y','-v','error','-i',stable,'-filter_complex_threads','1','-filter_complex',graph,'-map','[out]','-an','-c:v','libx264','-threads','2','-preset','medium','-crf','18','-r',fps,'-g',frames-fade,'-keyint_min',frames-fade,'-sc_threshold','0','-movflags','+faststart',destination)
        decoded=luma(destination)
        original=luma(stable)
        diffs=np.abs(np.diff(decoded,axis=0)).mean(axis=(1,2))
        seam=float(np.abs(decoded[-1]-decoded[0]).mean())
        reference=float(np.abs(original[fade]-original[fade-1]).mean())
        if len(decoded)!=frames-fade or seam>reference*1.3+.25:
            raise RuntimeError(f'{phase}: unexpected frame count or visible cyclic reset: {seam}, reference {reference}')
        drift=json.loads(subprocess.check_output([sys.executable,'scripts/check-monument-anchor.py',str(destination),json.dumps(anchor['outputAnchorBox'])],text=True))
        run('ffmpeg','-y','-v','error','-i',destination,'-frames:v','1','-q:v','3',output/f'{phase}.jpg')
        record={'sourceName':name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'fps':fps,'frames':len(decoded),'duration':len(decoded)/fps,'overlapSeconds':fade/fps,'seam':seam,'referenceSeam':reference,'medianFrameDifference':float(np.median(diffs)),'backgroundContinuity':drift,'stabilization':json.loads(registration.read_text()),'monumentAnchor':anchor}
        destination.replace(output/f'{phase}.mp4')
        with open('/tmp/laporkuy-background-manifest.lock','w') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            latest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
            manifest['phases']=latest.get('phases',{})
            manifest['phases'][phase]=record
            manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
        print(phase,json.dumps(record),flush=True)
