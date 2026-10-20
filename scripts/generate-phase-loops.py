"""Build forward-playing cyclic overlaps from the supplied 24 fps film.

Run from the repository root with ffmpeg installed. Tail/head overlap uses
smoothstep with exact 0/1 endpoint weights, then rotates the seam into the
middle of the clip. Cars never play backwards or change playback speed.
"""
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import tempfile

FPS = 24
source = Path('public/media/bundaran-hi-wib.mp4')
output = Path('public/media/phases')
output.mkdir(exist_ok=True)
# End-exclusive source frames. Longer overlaps distribute the reset smoothly.
clips = {'night': (204, 240, 12), 'morning': (54, 78, 8),
         'day': (84, 156, 24), 'evening': (162, 189, 9)}

def run(*args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
                    *map(str, args)], check=True)

def continuity(video):
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
            'seamRatio': seam / median if median else 0}

source_raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source),
    '-vf', 'scale=160:90', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
source_frames = [source_raw[i:i+160*90] for i in range(0, len(source_raw), 160*90)]
manifest = {}
with tempfile.TemporaryDirectory(prefix='laporkuy-loops-') as temporary:
    for phase, (start, end, fade) in clips.items():
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
        cycle = Path(temporary) / f'{phase}.mp4'
        run('-i', source, '-filter_complex_threads', 1, '-filter_complex', graph,
            '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'medium',
            '-crf', 0, '-g', FPS, '-sc_threshold', 0, cycle)
        # Continuous encoded repetitions avoid reopening the decoder every
        # 0.7–2 seconds. This adds no new traffic or fabricated motion.
        cycle_frames = count - fade
        repetitions = math.ceil(8 * FPS / cycle_frames)
        video = output / f'{phase}.mp4'
        run('-stream_loop', repetitions - 1, '-i', cycle, '-an',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', 20,
            '-g', FPS, '-keyint_min', FPS, '-sc_threshold', 0,
            '-movflags', '+faststart', video)
        metrics = continuity(video)
        if metrics['frames'] != cycle_frames * repetitions:
            raise RuntimeError(f'{phase}: unexpected frame count: {metrics}')
        reference = statistics.fmean(abs(a-b) for a,b in
            zip(source_frames[start+fade-1], source_frames[start+fade]))
        # Cars must move across the seam just as they do between these two
        # adjacent source frames. Allow only small additional codec error.
        if metrics['seam'] > reference * 1.25 + .15:
            raise RuntimeError(f'{phase}: excess discontinuity: {metrics}, reference={reference}')
        metrics['referenceSeam'] = reference
        run('-i', video, '-frames:v', 1, '-q:v', 3, output / f'{phase}.jpg')
        manifest[phase] = {**metrics, 'fps': FPS, 'cycleFrames': cycle_frames,
            'duration': metrics['frames'] / FPS,
            'sha256': hashlib.sha256(video.read_bytes()).hexdigest()}
        print(phase, json.dumps(manifest[phase]), flush=True)

Path('tests/fixtures').mkdir(exist_ok=True)
Path('tests/fixtures/video-loop-metrics.json').write_text(json.dumps({'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'phases': manifest}, indent=2) + '\n')
