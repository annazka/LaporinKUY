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
parser.add_argument('--work-directory',type=Path,help='Keep expensive interpolation caches and failed exports for inspection')
args = parser.parse_args()
output = args.output
output.mkdir(parents=True, exist_ok=True)
names = {'morning':'Pagi.mp4','day':'Siang.mp4','evening':'Sore.mp4','night':'malam.mp4'}
manifest_path = args.manifest
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
manifest = {'method':'forward footage; similarity camera correction, frame-blended morning/day, motion-compensated evening and smoothstep overlap', 'phases':manifest.get('phases',{})}

def run(*command):
    subprocess.run(list(map(str,command)), check=True)

def luma(path):
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-vf','scale=160:90','-f','rawvideo','-pix_fmt','gray','-'])
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1,90,160).astype(np.float32)

with tempfile.TemporaryDirectory(prefix='laporkuy-loop-') as temporary:
    work = args.work_directory or Path(temporary)
    work.mkdir(parents=True,exist_ok=True)
    for phase, name in names.items():
        if args.phase and args.phase != phase:
            continue
        source = args.sources / name
        stable = (args.stabilized or work) / f'{phase}-stable.mp4'
        registration = stable.with_name(f'{phase}-registration.json')
        if not args.stabilized:
            run(sys.executable,'scripts/stabilize-video.py',source,stable,registration)
        original_details=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=r_frame_rate,nb_frames','-of','json',str(stable)]))['streams'][0]
        source_frames=int(original_details['nb_frames'])
        source_rate=original_details['r_frame_rate']
        source_range=[0,source_frames]
        anchored=work/f'{phase}-monument.mp4'
        anchor_metadata=work/f'{phase}-monument.json'
        registration_data=json.loads(registration.read_text())
        if registration_data.get('method')!='whole-frame-similarity':
            raise RuntimeError('Reuse only similarity-registered clips; projective warps are not allowed')
        cuts=registration_data.get('cameraStepFrames',[])
        # Fixed continuous source ranges avoid the large changes of viewpoint
        # that make the outer buildings/roof appear to bend at a cyclic fade.
        if phase in ('morning','day') or (phase=='evening' and cuts):
            boundaries=[0,*cuts,source_frames]
            # Evening's opening take dollies backward; use its final camera
            # hold. Morning/day use their calibrated, quieter continuous ranges
            # rather than spanning the large source changes at the borders.
            source_range={'morning':(96,192),'day':(0,96)}.get(phase,list(zip(boundaries,boundaries[1:]))[-1])
            if source_range[1]>source_frames:raise RuntimeError('Source is shorter than its calibrated steady shot')
            trimmed=work/f'{phase}-continuous.mp4'
            if source_range[0]==0:
                run('ffmpeg','-y','-v','error','-i',stable,'-frames:v',source_range[1],'-an','-c:v','copy',trimmed)
            else:
                run('ffmpeg','-y','-v','error','-i',stable,'-vf',f'trim=start_frame={source_range[0]}:end_frame={source_range[1]},setpts=N/({source_rate}*TB)','-r',source_rate,'-fps_mode','cfr','-an','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','0',trimmed)
            stable=trimmed
        box=registration_data.get('outputAnchorBox')
        extra=[json.dumps(box)] if box else []
        run(sys.executable,'scripts/anchor-video-monument.py',stable,anchored,phase,anchor_metadata,*extra)
        anchor=json.loads(anchor_metadata.read_text())
        stable=anchored
        details=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=r_frame_rate,nb_frames','-of','json',str(stable)]))['streams'][0]
        numerator,denominator=map(int,details['r_frame_rate'].split('/'))
        fps=numerator/denominator
        frames=int(details['nb_frames'])
        minimum_source=3.5 if phase!='night' else 7
        if frames < minimum_source*fps:
            raise RuntimeError('Insufficient continuous source footage; do not repeat a short snippet')
        source_fps,selected_frames=fps,frames
        retiming=None
        if phase!='night':
            # User approved slower traffic to match the accepted night cycle.
            # Interpolate intact, stabilized footage BEFORE the dissolve: flow
            # across an already blended seam can bend cars/buildings.
            fps,frames=30,550
            duration=frames/fps
            speed=(selected_frames/source_fps)/duration
            preserve_geometry=phase in ('morning','day')
            interpolation_method='frame-blend-interpolation' if preserve_geometry else 'motion-compensated-interpolation'
            slowed=work/f'{phase}-slow.mp4'
            stamp=slowed.with_suffix('.json')
            signature={'inputSha256':hashlib.sha256(stable.read_bytes()).hexdigest(),
                'frames':frames,'fps':fps,'method':'frame-blend-source-lookahead-v1' if preserve_geometry else 'mci-aobmc-bidir-vsbmc-source-lookahead-v2'}
            # Add lookahead in SOURCE frames before retiming. Padding seconds
            # afterward retains nominal input cadence and can truncate the
            # interpolated head/tail, preventing the fade reaching its endpoint.
            # Frame blending averages intact adjacent frames without deforming
            # architecture with per-block optical-flow fields at the edges.
            mode='blend' if preserve_geometry else 'mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1'
            interpolation=(f'tpad=stop_mode=clone:stop=3,settb=AVTB,setpts=N*{duration}/({selected_frames}*TB),'
                f'minterpolate=fps={fps}:mi_mode={mode},'
                f'trim=end_frame={frames},settb=1/{fps},setpts=N')
            if not (slowed.exists() and stamp.exists() and json.loads(stamp.read_text())==signature):
                print(f'{phase}: interpolating {selected_frames} source frames to {frames} frames at {fps} fps; speed {speed:.4f}x',flush=True)
                stamp.unlink(missing_ok=True)
                run('ffmpeg','-y','-v','error','-i',stable,'-filter_threads','1','-vf',interpolation,
                    '-an','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','0',
                    '-r',fps,'-fps_mode','cfr',slowed)
            else:print(f'{phase}: reusing verified interpolation cache',flush=True)
            probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
                '-show_entries','stream=nb_frames,r_frame_rate','-of','json',str(slowed)]))['streams'][0]
            if int(probe['nb_frames'])!=frames or probe['r_frame_rate']!='30/1':
                raise RuntimeError(f'{phase}: interpolation frame count/rate mismatch: {probe}')
            stamp.write_text(json.dumps(signature))
            retiming={'method':interpolation_method,'sourceFps':source_fps,
                'sourceFrames':selected_frames,'speed':speed,'interpolatedFrames':frames,
                'outputFps':fps,'interpolateBeforeDissolve':True}
            stable=slowed
        overlap=3
        fade=round(overlap*fps)
        if frames < fade*2+fps:
            raise RuntimeError('Insufficient interpolated footage for the dissolve')
        t=f'clip(T/{(fade-1)/fps},0,1)'
        weight=f'({t})*({t})*(3-2*({t}))'
        graph=(f'[0:v]scale=1280:720,setsar=1,split=3[h][m][t];'
            f'[h]trim=end_frame={fade},settb=1/{fps},setpts=N[head];'
            f'[m]trim=start_frame={fade}:end_frame={frames-fade},settb=1/{fps},setpts=N[middle];'
            f'[t]trim=start_frame={frames-fade},settb=1/{fps},setpts=N[tail];'
            f"[tail][head]blend=all_expr='A*(1-({weight}))+B*({weight})':shortest=1[bridge];"
            f'[middle][bridge]concat=n=2:v=1:a=0,format=yuv420p[out]')
        destination=work/f'{phase}.mp4'
        # Slow scenes expose codec texture changes at the I/P loop join. Keep
        # more detail and equal frame-type quality rather than relaxing the
        # seam guard merely because the actual motion is now much smaller.
        quality=['-crf','12','-x264-params','ipratio=1:pbratio=1'] if retiming else ['-crf','18']
        run('ffmpeg','-y','-v','error','-i',stable,'-filter_complex_threads','1','-filter_complex',graph,'-map','[out]','-an','-c:v','libx264','-threads','2','-preset','medium',*quality,'-r',fps,'-g',frames-fade,'-keyint_min',frames-fade,'-sc_threshold','0','-movflags','+faststart',destination)
        decoded=luma(destination)
        original=luma(stable)
        diffs=np.abs(np.diff(decoded,axis=0)).mean(axis=(1,2))
        seam=float(np.abs(decoded[-1]-decoded[0]).mean())
        reference=float(np.abs(original[fade]-original[fade-1]).mean())
        if len(decoded)!=frames-fade or seam>reference*1.3+.25:
            raise RuntimeError(f'{phase}: unexpected frame count ({len(decoded)} vs {frames-fade}) or visible cyclic reset: {seam}, reference {reference}')
        drift=json.loads(subprocess.check_output([sys.executable,'scripts/check-monument-anchor.py',str(destination),json.dumps(anchor['outputAnchorBox'])],text=True))
        motion=json.loads(subprocess.check_output([sys.executable,'scripts/check-video-motion.py',str(destination)],text=True))
        poster=work/f'{phase}.jpg'
        run('ffmpeg','-y','-v','error','-i',destination,'-frames:v','1','-q:v','3',poster)
        record={'sourceName':name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'fps':fps,'frames':len(decoded),'duration':len(decoded)/fps,'overlapSeconds':fade/fps,'sourceFrameRange':list(source_range),'originalSourceFrames':source_frames,'seam':seam,'referenceSeam':reference,'medianFrameDifference':float(np.median(diffs)),'backgroundContinuity':drift,'peripheralMotion':motion,'stabilization':json.loads(registration.read_text()),'monumentAnchor':anchor}
        if retiming:record['retiming']=retiming
        if phase in ('morning','day'):
            edges=json.loads(subprocess.check_output([sys.executable,'scripts/check-video-edge-shape.py',str(destination)],text=True))
            record['edgeShape']=edges
            reference=Path(f'public/media/phases/{phase}.mp4')
            if reference.exists():
                previous=json.loads(subprocess.check_output([sys.executable,'scripts/check-video-edge-shape.py',str(reference)],text=True))
                active_sha=hashlib.sha256(reference.read_bytes()).hexdigest()
                record['edgeReference']={'sha256':active_sha,'shape':previous}
                if active_sha==record['sha256']:
                    # Rebuilding an identical validated export is not a new
                    # improvement; keep its original comparison when available.
                    record['edgeReference']=manifest['phases'].get(phase,{}).get('edgeReference',record['edgeReference'])
                elif edges['worstRegionP95Pixels']>=previous['worstRegionP95Pixels'] or edges['meanRegionP95Pixels']>=previous['meanRegionP95Pixels']:
                    raise RuntimeError(f'{phase}: edge shape did not improve against the active clip')
        if phase=='evening':
            framing=json.loads(subprocess.check_output([sys.executable,'scripts/check-video-framing.py',str(destination)],text=True))
            if any(region['maximumMedianDriftPixels']>region['limitPixels'] for region in framing['regions'].values()):
                raise RuntimeError('Evening camera hold still contains excessive accumulated scene drift')
            record['fixedView']=framing
            record['shotSelection']='final camera hold; exclude opening backward dolly'
            reference=Path('public/media/phases/night.mp4')
            reference_motion=json.loads(subprocess.check_output([sys.executable,'scripts/check-video-motion.py',str(reference)],text=True))
            record['peripheralReference']={'phase':'night','sha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'motion':reference_motion}
        destination.replace(output/f'{phase}.mp4')
        poster.replace(output/f'{phase}.jpg')
        with open('/tmp/laporkuy-background-manifest.lock','w') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            latest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
            manifest['phases']=latest.get('phases',{})
            manifest['phases'][phase]=record
            manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
        print(phase,json.dumps(record),flush=True)
