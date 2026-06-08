// apps/portfolio/scripts/generate-sprite.mjs
// Generates public/mini-dogan.png — a cursor-chasing mascot sprite sheet that
// composites Dogan's REAL face photo (the head) onto an animated pixel body.
//
// Sheet: 8 cols x 4 rows of 56px cells (448x224). The cell COORDINATES match
// oneko.gif exactly so the chase engine's sprite map works unchanged; only the
// cell SIZE is scaled up (32 -> 56) so the real face is recognizable.
//
// Usage (from apps/portfolio): node scripts/generate-sprite.mjs
import sharp from "sharp";

const CELL = 56;
const COLS = 8;
const ROWS = 4;
const SHEET_W = COLS * CELL; // 448
const SHEET_H = ROWS * CELL; // 224
const FACE_SRC = "../../docs/superpowers/specs/assets/mascot-face-reference.webp";

// ---------------------------------------------------------------------------
// Pixel body art (torso + animated legs, no head — the photo is the head).
// 12 wide x 9 tall, rendered at scale 2 -> 24x18 px in the 56px cell.
// ---------------------------------------------------------------------------
const PALETTE = {
  _: null,                 // transparent
  B: [44, 62, 102, 255],   // shirt dark blue
  b: [33, 47, 78, 255],    // shirt shading
  S: [232, 184, 138, 255], // hand/skin
  P: [51, 51, 51, 255],    // pants
  K: [26, 26, 26, 255],    // shoes
  W: [255, 255, 255, 255], // overlay (Z / !)
};

const BODY_STAND = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBbB_",
  "_SbBBBBBBbS_",
  "__PPPPPPPP__",
  "__PP____PP__",
  "__PP____PP__",
  "__KK____KK__",
];
const BODY_RUN_A = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_SbBBBBBBbB_",
  "__BBBBBBBbS_",
  "__PPPPPPPP__",
  "_PP______PP_",
  "_PP______PP_",
  "_KK______KK_",
];
const BODY_RUN_B = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBbS_",
  "_SbBBBBBBB__",
  "__PPPPPPPP__",
  "___PP__PP___",
  "___PP__PP___",
  "___KK__KK___",
];
const BODY_WAVE = [
  "__BBBBBBBBS_",
  "_BBBBBBBBBb_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBB__",
  "_SbBBBBBBB__",
  "__PPPPPPPP__",
  "__PP____PP__",
  "__PP____PP__",
  "__KK____KK__",
];
const OVERLAY_Z = ["WWW", "__W", "_W_", "WWW"]; // 3x4

// Validation: every grid must have equal-length rows.
const GRIDS = { BODY_STAND, BODY_RUN_A, BODY_RUN_B, BODY_WAVE, OVERLAY_Z };
for (const [name, grid] of Object.entries(GRIDS)) {
  const w = grid[0].length;
  grid.forEach((row, i) => {
    if (row.length !== w) throw new Error(`Grid ${name} row ${i} has length ${row.length}, expected ${w}`);
  });
}

// ---------------------------------------------------------------------------
// Body raster layer (drawn into a single 448x224 RGBA buffer).
// ---------------------------------------------------------------------------
const body = new Uint8Array(SHEET_W * SHEET_H * 4);

function drawGrid(buf, grid, x0, y0, { mirror = false, scale = 2 } = {}) {
  const h = grid.length, w = grid[0].length;
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const ch = grid[gy][mirror ? w - 1 - gx : gx];
      const rgba = PALETTE[ch];
      if (!rgba) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = x0 + gx * scale + sx;
          const py = y0 + gy * scale + sy;
          if (px < 0 || py < 0 || px >= SHEET_W || py >= SHEET_H) continue;
          buf.set(rgba, (py * SHEET_W + px) * 4);
        }
      }
    }
  }
}

// Body is 24px wide (12*2), centered in the 56px cell; sits in the lower half.
const BODY_W = 24;
const BODY_X = Math.round((CELL - BODY_W) / 2); // 16
const BODY_Y = 35; // pushed down so the full head (incl. chin/jaw) shows above the shirt

// Head-composite jobs collected here, applied via sharp after the body layer.
const headJobs = []; // { col, row, mirror, bob }

function place(col, row, { bodyGrid = null, mirrorBody = false, bob = 0, headMirror = false, overlay = null } = {}) {
  if (bodyGrid) drawGrid(body, bodyGrid, col * CELL + BODY_X, row * CELL + BODY_Y + bob, { mirror: mirrorBody });
  if (overlay === "Z") drawGrid(body, OVERLAY_Z, col * CELL + 40, row * CELL + 2);
  headJobs.push({ col, row, mirror: headMirror, bob });
}

// Sleeping: head + Z only, lower in the cell, no standing body.
function placeSleeping(col, row, zOffset) {
  drawGrid(body, OVERLAY_Z, col * CELL + 34 + zOffset, row * CELL + 6 + zOffset);
  headJobs.push({ col, row, mirror: false, bob: 14 });
}

// --- Cell map (identical coordinates to oneko.gif) -------------------------
// idle / alert / tired
place(3, 3, { bodyGrid: BODY_STAND });
place(7, 3, { bodyGrid: BODY_STAND });
place(3, 2, { bodyGrid: BODY_STAND, overlay: "Z" });
// sleeping (2 frames)
placeSleeping(2, 0, 0);
placeSleeping(2, 1, 2);
// wave (was scratchSelf)
place(5, 0, { bodyGrid: BODY_WAVE });
place(6, 0, { bodyGrid: BODY_STAND });
place(7, 0, { bodyGrid: BODY_WAVE });
// stretch toward walls (was scratchWall*)
place(0, 0, { bodyGrid: BODY_WAVE });
place(0, 1, { bodyGrid: BODY_STAND });
place(7, 1, { bodyGrid: BODY_WAVE });
place(6, 2, { bodyGrid: BODY_STAND });
place(2, 2, { bodyGrid: BODY_WAVE });
place(2, 3, { bodyGrid: BODY_STAND });
place(4, 0, { bodyGrid: BODY_WAVE, mirrorBody: true, headMirror: true });
place(4, 1, { bodyGrid: BODY_STAND, mirrorBody: true, headMirror: true });
// runs — N (away) and S (toward) use the front body; E/W use side strides
place(1, 2, { bodyGrid: BODY_RUN_A });
place(1, 3, { bodyGrid: BODY_RUN_B, bob: 1 });
place(6, 3, { bodyGrid: BODY_RUN_A });
place(7, 2, { bodyGrid: BODY_RUN_B, bob: 1 });
place(3, 0, { bodyGrid: BODY_RUN_A });
place(3, 1, { bodyGrid: BODY_RUN_B, bob: 1 });
place(4, 2, { bodyGrid: BODY_RUN_A, mirrorBody: true, headMirror: true });
place(4, 3, { bodyGrid: BODY_RUN_B, mirrorBody: true, bob: 1, headMirror: true });
// diagonals reuse nearest cardinal body
place(0, 2, { bodyGrid: BODY_RUN_A });
place(0, 3, { bodyGrid: BODY_RUN_B, bob: 1 });
place(1, 0, { bodyGrid: BODY_RUN_A, headMirror: true });
place(1, 1, { bodyGrid: BODY_RUN_B, bob: 1, headMirror: true });
place(5, 1, { bodyGrid: BODY_RUN_A });
place(5, 2, { bodyGrid: BODY_RUN_B, bob: 1 });
place(5, 3, { bodyGrid: BODY_RUN_A, mirrorBody: true, headMirror: true });
place(6, 1, { bodyGrid: BODY_RUN_B, mirrorBody: true, bob: 1, headMirror: true });

// ---------------------------------------------------------------------------
// Prepare the real-face head (normal + mirrored) and composite into each cell.
// ---------------------------------------------------------------------------
const HEAD_H = 34; // px tall in the cell

// Trim transparent margin, crop to the head (drop shoulders), resize.
const trimmed = await sharp(FACE_SRC).trim().toBuffer({ resolveWithObject: true });
const tw = trimmed.info.width;
const th = trimmed.info.height;
const headCropH = Math.round(th * 0.82); // cap-top through chin/jaw (more of the lower face)
const headBuf = await sharp(trimmed.data)
  .extract({ left: 0, top: 0, width: tw, height: headCropH })
  .resize({ height: HEAD_H })
  .png()
  .toBuffer({ resolveWithObject: true });
const HEAD_W = headBuf.info.width;
const headNormal = headBuf.data;
const headMirror = await sharp(headBuf.data).flop().png().toBuffer();

const HEAD_X = Math.round((CELL - HEAD_W) / 2);
const HEAD_Y = 1;

const composites = headJobs.map((j) => ({
  input: j.mirror ? headMirror : headNormal,
  left: j.col * CELL + HEAD_X,
  top: j.row * CELL + HEAD_Y + (j.bob || 0),
}));

const rawBody = { raw: { width: SHEET_W, height: SHEET_H, channels: 4 } };
const sheet = await sharp(Buffer.from(body), rawBody).composite(composites).png().toBuffer();

await sharp(sheet).toFile("public/mini-dogan.png");
await sharp(sheet)
  .resize(SHEET_W * 4, SHEET_H * 4, { kernel: "nearest" })
  .png()
  .toFile("../../docs/superpowers/specs/assets/sprite-preview.png");

console.log(`Wrote public/mini-dogan.png (${SHEET_W}x${SHEET_H}, ${CELL}px cells) and sprite-preview.png`);
console.log(`Head size: ${HEAD_W}x${HEAD_H}px`);
