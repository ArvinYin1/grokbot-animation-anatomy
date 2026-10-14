#!/bin/bash
# 用法: tools/capture/make-gif.sh <out.gif> <schedule> <from> <to> <fps> <cols> [cell]
# 例: tools/capture/make-gif.sh docs/media/hero.gif idle:0 0.1 3.1 20 10
set -e
cd "$(dirname "$0")/../.."
OUT="$1"; SCHEDULE="$2"; FROM="$3"; TO="$4"; FPS="$5"; COLS="$6"; CELL="${7:-340}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8123

python3 - <<EOF
frames = int(round(($TO - $FROM) * $FPS))
rows = (frames + $COLS - 1) // $COLS
print(f"{frames} {rows}")
EOF

read FRAMES ROWS <<< "$(python3 -c "
frames = int(round(($TO - $FROM) * $FPS))
rows = (frames + $COLS - 1) // $COLS
print(frames, rows)")"
W=$((COLS * CELL)); H=$((ROWS * CELL))

python3 -m http.server $PORT >/dev/null 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 0.5

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=$W,$H --virtual-time-budget=20000 \
  --screenshot=/tmp/film-grid.png \
  "http://localhost:$PORT/tools/capture/film.html?schedule=$SCHEDULE&from=$FROM&to=$TO&fps=$FPS&cols=$COLS&cell=$CELL"

python3 - "$OUT" "$FRAMES" "$COLS" "$ROWS" "$CELL" "$FPS" <<'EOF'
import sys
from PIL import Image
out, frames, cols, rows, cell, fps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), float(sys.argv[6])
grid = Image.open('/tmp/film-grid.png').convert('RGB')
shots = []
for i in range(frames):
    x, y = (i % cols) * cell, (i // cols) * cell
    shots.append(grid.crop((x, y, x + cell, y + cell)))
shots[0].save(out, save_all=True, append_images=shots[1:],
              duration=int(1000 / fps), loop=0, optimize=True)
print(f'{out}: {frames} frames @ {fps}fps')
EOF
