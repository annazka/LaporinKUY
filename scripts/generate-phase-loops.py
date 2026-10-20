"""Build forward-playing cyclic overlaps while retaining each source frame rate.

Run from the repository root with ffmpeg installed. Tail/head overlap uses
smoothstep with exact 0/1 endpoint weights, then rotates the seam into the
middle of the clip. Cars never play backwards or change playback speed.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import tempfile

source = Path('public/media/bundaran-hi-wib.mp4')
output = Path('public/media/phases')
output.mkdir(exist_ok=True)
# End-exclusive source frames. Night uses one 22-second section of the original
# recording (the 88.2-second file already repeats this section); a repeated short snippet cannot replace that footage.
night_source = Path('public/media/sources/bundaran-hi-night-original.mp4')
clips = {'night': (night_source, 30, 0, 660, 90),
         'morning': (source, 24, 54, 78, 8),
         'day': (source, 24, 84, 156, 24),
         'evening': (source, 24, 162, 189, 9)}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--phase', choices=clips, help='Rebuild only this phase')
selected = parser.parse_args().phase

def run(*args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
                    *map(str, args)], check=True)

def continuity(video, fps):
    # Downsampled luma difference: the boundary should look like an ordinary
    # moving frame, not a large reset. Standard library only; no extra packages.
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(video),
           '-vf', 'scale=160:90', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
    size = 160 * 90
    frames = [raw[i:i + size] for i in range(0, len(raw), size)]
    delta = lambda a, b: statistics.fmean(abs(x - y) for x, y in zip(a, b))
    ordinary = [delta(a, b) for a, b in zip(frames, frames[1:])]
    seam = delta(frames[-1], frames[0])
    median = statistics.median(ordinary)
    return {'frames': len(frames), 'seam': seam, 'median': median,
            'seamRatio': seam / median if median else 0,
            'oneSecondDifference': statistics.median(delta(frames[i], frames[i-fps])
                for i in range(fps, min(len(frames), fps*12), fps))}

fixture_path = Path('tests/fixtures/video-loop-metrics.json')
fixture = json.loads(fixture_path.read_text()) if fixture_path.exists() else {'phases': {}}
manifest = fixture['phases']
with tempfile.TemporaryDirectory(prefix='.phase-build-', dir=output) as temporary:
    for phase, (clip_source, FPS, start, end, fade) in clips.items():
        if selected and phase != selected:
            continue
        source_raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(clip_source),
            '-vf', 'scale=160:90', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
        source_frames = [source_raw[i:i+160*90] for i in range(0, len(source_raw), 160*90)]
        count = end - start
        # The final overlap frame is at (fade-1)/fps, not fade/fps. Using the
        # latter left 25% of the old tail visible at the loop seam previously.
        t = f'clip(T/{(fade - 1) / FPS},0,1)'
        weight = f'({t})*({t})*(3-2*({t}))'
        graph = (
            f'[0:v]fps={FPS},trim=start_frame={start}:end_frame={end},'
            'setpts=PTS-STARTPTS,split=3[h][m][t];'
            f'[h]trim=end_frame={fade},fps={FPS},settb=1/{FPS},setpts=N[head];'
            f'[m]trim=start_frame={fade}:end_frame={count-fade},fps={FPS},settb=1/{FPS},setpts=N[middle];'
            f'[t]trim=start_frame={count-fade},fps={FPS},settb=1/{FPS},setpts=N[tail];'
            f"[tail][head]blend=all_expr='A*(1-({weight}))+B*({weight})':shortest=1[bridge];"
            f'[middle][bridge]concat=n=2:v=1:a=0,fps={FPS},format=yuv420p[out]'
        )
        cycle_frames = count - fade
        repetitions = math.ceil(8 * FPS / cycle_frames)
        video = Path(temporary) / f'{phase}-final.mp4'
        if repetitions == 1:
            # Real continuous footage, not an extended file of repeated snippets.
            run('-i', clip_source, '-filter_complex_threads', 1, '-filter_complex', graph,
                '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'medium',
                '-b:v', '1800k', '-maxrate', '2200k', '-bufsize', '3600k',
                '-g', FPS * 2, '-keyint_min', FPS * 2, '-sc_threshold', 0,
                '-movflags', '+faststart', video)
        else:
            cycle = Path(temporary) / f'{phase}.mp4'
            run('-i', clip_source, '-filter_complex_threads', 1, '-filter_complex', graph,
                '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'medium',
                '-crf', 0, '-g', FPS, '-sc_threshold', 0, cycle)
            run('-stream_loop', repetitions - 1, '-i', cycle, '-an',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', 20,
                '-g', FPS, '-keyint_min', FPS, '-sc_threshold', 0,
                '-movflags', '+faststart', video)
        metrics = continuity(video, FPS)
        if metrics['frames'] != cycle_frames * repetitions:
            raise RuntimeError(f'{phase}: unexpected frame count: {metrics}')
        reference = statistics.fmean(abs(a-b) for a,b in
            zip(source_frames[start+fade-1], source_frames[start+fade]))
        # Cars must move across the seam just as they do between these two
        # adjacent source frames. Allow only small additional codec error.
        if metrics['seam'] > reference * 1.25 + .15:
            raise RuntimeError(f'{phase}: excess discontinuity: {metrics}, reference={reference}')
        metrics['referenceSeam'] = reference
        metrics['sourcePath'] = '/' + str(clip_source.relative_to('public'))
        metrics['sourceSha256'] = hashlib.sha256(clip_source.read_bytes()).hexdigest()
        metrics['repetitions'] = repetitions
        metrics['sourceStartFrame'] = start
        metrics['sourceEndFrame'] = end
        run('-i', video, '-frames:v', 1, '-q:v', 3, output / f'{phase}.jpg')
        manifest[phase] = {**metrics, 'fps': FPS, 'cycleFrames': cycle_frames,
            'duration': metrics['frames'] / FPS,
            'sha256': hashlib.sha256(video.read_bytes()).hexdigest()}
        video.replace(output / f'{phase}.mp4')
        print(phase, json.dumps(manifest[phase]), flush=True)

Path('tests/fixtures').mkdir(exist_ok=True)
fixture_path.write_text(json.dumps({'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'phases': manifest}, indent=2) + '\n')
