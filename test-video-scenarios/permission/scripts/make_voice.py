# make_voice.py — tao giong doc tieng Viet (gTTS) cho tung buoc cua kich ban
# CAI: pip install gTTS
# DUNG: python make_voice.py <out_dir> <pairs_file>
#   pairs_file: moi dong "name|text"  (name khong cach dau, thu tu mong muon)
#   -> sinh <out_dir>/kb_<name>.mp3  (ten da duoc trim khoang trang dau)
import sys, os
from gtts import gTTS


def main():
    if len(sys.argv) < 3:
        print("Usage: python make_voice.py <out_dir> <pairs_file>")
        print("  pairs_file: moi dong 'name|text' (name khong cach dau)")
        sys.exit(1)
    out_dir = sys.argv[1]
    pairs_file = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    with open(pairs_file, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or '|' not in line:
                continue
            name, text = line.split('|', 1)
            name = name.strip().lstrip()   # trim khoang trang dau (QUAN TRONG)
            text = text.strip()
            if not name or not text:
                continue
            out = os.path.join(out_dir, "kb_%s.mp3" % name)
            gTTS(text=text, lang='vi', slow=False).save(out)
            print('saved', out)


if __name__ == '__main__':
    main()
