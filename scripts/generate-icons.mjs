// Regenerate all app/extension icons from a single source logo.
//   node scripts/generate-icons.mjs [path-to-logo.png]   (defaults to brand/logo.png)
// Produces square, transparent, aspect-preserved PNGs (no distortion).
import sharp from "sharp";

const SRC = process.argv[2] ?? "brand/logo.png";
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const targets = [
  ["packages/extension/src/assets/icon-16.png", 16],
  ["packages/extension/src/assets/icon-48.png", 48],
  ["packages/extension/src/assets/icon-128.png", 128],
  ["packages/web-app/public/favicon-16.png", 16],
  ["packages/web-app/public/favicon-32.png", 32],
  ["packages/web-app/public/apple-touch-icon.png", 180],
  ["packages/web-app/public/icon-192.png", 192],
  ["packages/web-app/public/icon-512.png", 512],
];

for (const [out, size] of targets) {
  const inner = Math.round(size * 0.84); // ~8% breathing room each side
  const mark = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: transparent })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: transparent } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("✓", out, `${size}px`);
}
