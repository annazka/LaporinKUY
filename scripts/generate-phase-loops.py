"""Build forward-playing phase loops from the supplied 24 fps Bundaran HI film.

Run from the repository root with ffmpeg installed. No reverse playback, frame
interpolation, or playback-speed changes: only trims and a short loop dissolve.
The tail dissolves into the head, followed by the middle on the next cycle.
"""
from pathlib import Path
import subprocess

source = Path('public/media/bundaran-hi-wib.mp4')
output = Path('public/media/phases')
output.mkdir(exist_ok=True)
# Exact source frame ranges, end exclusive; blend lengths in frames.
clips = {'night': (204, 240, 4), 'morning': (54, 78, 4),
         'day': (84, 156, 6), 'evening': (162, 189, 4)}
for phase, (start, end, fade) in clips.items():
    count = end - start
    graph = (
        f'[0:v]trim=start_frame={start}:end_frame={end},setpts=PTS-STARTPTS,split=3[h][m][t];'
        f'[h]trim=end_frame={fade},setpts=PTS-STARTPTS,fps=24,settb=AVTB[head];'
        f'[m]trim=start_frame={fade}:end_frame={count-fade},setpts=PTS-STARTPTS,fps=24,settb=AVTB[middle];'
        f'[t]trim=start_frame={count-fade},setpts=PTS-STARTPTS,fps=24,settb=AVTB[tail];'
        f'[tail][head]xfade=transition=fade:duration={fade/24}:offset=0[bridge];'
        '[middle][bridge]concat=n=2:v=1:a=0,format=yuv420p[out]'
    )
    video = output / f'{phase}.mp4'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
                    '-i', str(source), '-filter_complex_threads', '1',
                    '-filter_complex', graph, '-map', '[out]', '-an',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
                    '-g', '24', '-keyint_min', '24', '-sc_threshold', '0',
                    '-movflags', '+faststart', str(video)], check=True)
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
                    '-i', str(video), '-frames:v', '1', '-q:v', '3',
                    str(output / f'{phase}.jpg')], check=True)
    print(phase, 'source frames', start, end, 'loop dissolve', fade, flush=True)
