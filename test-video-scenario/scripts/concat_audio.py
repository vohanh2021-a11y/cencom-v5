#!/usr/bin/env python3
import subprocess
import os

vdir = r'E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\test-video-scenarios\registration\videos'

# Convert each MP3 to WAV (mono, 24000 Hz)
mp3_files = ['kb_intro.mp3', 'kb_step1.mp3', 'kb_step2.mp3', 'kb_step3.mp3', 'kb_hoan.mp3']
wav_files = []
for f in mp3_files:
    in_path = os.path.join(vdir, f)
    out_path = os.path.join(vdir, f.replace('.mp3', '.wav'))
    cmd = ['ffmpeg', '-y', '-i', in_path, '-acodec', 'pcm_s16le', '-ar', '24000', '-ac', '1', out_path]
    r = subprocess.run(cmd, capture_output=True, text=True)
    wav_files.append(out_path)
    print(f'Converted {f}: returncode={r.returncode}')

# Build ffmpeg concat command
inputs = ' '.join([f'-i "{f}"' for f in wav_files])
filter_str = '[0:a][1:a][2:a][3:a][4:a]concat=n=5:v=0:a=1[out]'
output = os.path.join(vdir, 'kb_all_concat.wav')
cmd = f'ffmpeg -y {inputs} -filter_complex "{filter_str}" -c:a pcm_s16le -ac 1 "{output}"'
print('Running:', cmd)
r = subprocess.run(cmd, capture_output=True, text=True)
print('Return code:', r.returncode)
print('STDOUT:', r.stdout)
if r.stderr:
    print('STDERR:', r.stderr[:500])