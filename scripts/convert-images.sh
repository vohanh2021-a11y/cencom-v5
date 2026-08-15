#!/usr/bin/env bash
# convert-images.sh — Convert all images in apps/web/public/images to WebP
# Usage: bash scripts/convert-images.sh [quality]  (default: 85)
# Requires: sharp CLI (npx sharp)

set -euo pipefail

QUALITY="${1:-85}"
SRC_DIR="apps/web/public/images"
OUT_DIR="apps/web/public/images"

if [ ! -d "$SRC_DIR" ]; then
  echo "No images directory found at $SRC_DIR"
  echo "Create a directory and add images to optimize:"
  echo "  mkdir -p $SRC_DIR"
  exit 0
fi

echo "Converting images to WebP (quality: $QUALITY)..."
find "$SRC_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.tiff" -o -iname "*.tif" \) | while read -r file; do
  out="${file%.*}.webp"
  echo "  -> $file -> $out"
  npx sharp "$file" --webp --quality "$QUALITY" --output "$out"
done

echo ""
echo "✅ Done. All images converted to WebP."
echo "Usage in React: <Image src='/images/xxx.webp' width={W} height={H} alt='...' loading='lazy' />"
