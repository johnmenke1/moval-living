/**
 * Generate a handwritten-style "John Menke" signature PNG.
 * Uses sharp + SVG (text-on-path approach with a script font).
 *
 * If you want a real pen-on-paper look, upload a scan to S3 at
 * https://movalliving.s3.us-west-1.amazonaws.com/john-signature.png
 * and update the email template to use that URL instead.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SIGNATURE_TEXT = 'John Menke';
const WIDTH = 280;
const HEIGHT = 90;

// Build SVG. Use a script-style system font via SVG <text> with italic + bold.
// Since web-fonts aren't guaranteed in PIL/sharp rendering, we'll layer
// the text with multiple transforms to mimic a handwritten look:
//   - slight slant (skewX)
//   - varied opacity for stroke feel
//   - cursive fallback family
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <style>
      .sig {
        font-family: 'Brush Script MT', 'Lucida Handwriting', 'Apple Chancery', cursive;
        font-style: italic;
        font-weight: 700;
        font-size: 56px;
        fill: #1f2937;
      }
      .underline {
        stroke: #1f2937;
        stroke-width: 2.5;
        stroke-linecap: round;
        fill: none;
        opacity: 0.85;
      }
    </style>
  </defs>
  <g transform="translate(20, 18) skewX(-8)">
    <text class="sig" x="0" y="48">${SIGNATURE_TEXT}</text>
  </g>
  <path class="underline" d="M 30 78 Q 110 86, 230 76" />
</svg>`;

const outDir = path.resolve('docs');
const outPath = path.join(outDir, 'john-signature.png');

sharp(Buffer.from(svg))
  .png()
  .toFile(outPath)
  .then(() => {
    console.log(`✅ Wrote ${outPath}`);
  })
  .catch((e) => {
    console.error('Failed:', e.message);
    process.exit(1);
  });
