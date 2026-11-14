"""Build js/sfx.data.js from the recorded sound effects in audio/sfx/.

Files are named <effect>_<take>.mp3, for example ar_1.mp3 ... ar_4.mp3. The
effect name matches a key of JO.Audio.sounds (amb_* files are ambience loops).
Each take is trimmed of leading silence, made mono, loudness-normalized and
re-encoded small with ffmpeg, then embedded as base64 so the game also runs
from file:// with no network access.

    python tools/build_sfx.py            # needs ffmpeg on PATH
"""
import base64, glob, json, os, re, subprocess, sys, tempfile
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'audio', 'sfx')
OUT = os.path.join(ROOT, 'js', 'sfx.data.js')


def peak_db(path):
    """Loudest sample in dB; takes that came back nearly silent are skipped."""
    r = subprocess.run(['ffmpeg', '-nostdin', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'],
                       stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=60)
    m = re.search(r'max_volume: (-?[0-9.]+) dB', r.stderr)
    return float(m.group(1)) if m else -99.0


def encode(path, loop):
    """Return the processed MP3 bytes for one take."""
    filters = [] if loop else ['silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005']
    filters += ['aresample=44100', 'loudnorm=I=-16:TP=-1.5:LRA=11', 'aresample=44100']
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, 'o.mp3')
        cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', path, '-af', ','.join(filters), '-ac', '1', '-ar', '44100',
               '-b:a', '112k' if loop else '80k', out]
        subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL, timeout=60)
        with open(out, 'rb') as f:
            return f.read()


def main():
    takes = defaultdict(list)
    for p in sorted(glob.glob(os.path.join(SRC, '*.mp3'))):
        m = re.match(r'(.+)_(\d+)\.mp3$', os.path.basename(p))
        if m:
            takes[m.group(1)].append(p)
    data, total, skipped = {}, 0, []
    for name in sorted(takes):
        data[name] = []
        for p in takes[name]:
            if peak_db(p) < -30:
                skipped.append(os.path.basename(p))
                continue
            raw = encode(p, name.startswith('amb_'))
            total += len(raw)
            data[name].append(base64.b64encode(raw).decode('ascii'))
    if skipped:
        print('skipped (nearly silent):', ', '.join(skipped))
    data = {k: v for k, v in data.items() if v}
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('/* generated from audio/sfx/ by tools/build_sfx.py - do not edit */\n')
        f.write('window.JO_SFX = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print('effects: %d, takes: %d, audio %.0f KB, %s %.0f KB' % (
        len(data), sum(len(v) for v in data.values()), total / 1024, os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    sys.exit(main())
