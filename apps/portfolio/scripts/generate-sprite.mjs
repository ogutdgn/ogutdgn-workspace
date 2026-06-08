// apps/portfolio/scripts/generate-sprite.mjs
// Generates public/mini-dogan.png (256x128, 8x4 cells of 32px) — same cell
// layout as oneko.gif so the chase engine's sprite map is unchanged.
// Usage (from apps/portfolio): node scripts/generate-sprite.mjs
import sharp from "sharp";

const PALETTE = {
  _: null,                 // transparent
  C: [155, 155, 155, 255], // cap gray (lighter, more visible)
  D: [105, 105, 105, 255], // cap brim / shading
  H: [38,  24,  10,  255], // hair very dark brown/black
  S: [228, 182, 136, 255], // skin warm
  G: [80,  80,  80,  255], // glasses frame (medium gray — visible on skin bg)
  g: [215, 215, 215, 255], // glasses lens (very light gray — clearly see-through)
  e: [20,  20,  20,  255], // eyes (pupils through lenses)
  B: [44,  62,  102, 255], // shirt dark blue
  b: [28,  42,  72,  255], // shirt shading
  P: [50,  50,  50,  255], // pants
  K: [15,  15,  15,  255], // shoes black
  W: [255, 255, 255, 255], // highlight / Z / !
  M: [168, 88,  70,  255], // lips subtle
  n: [200, 155, 110, 255], // nose/shadow (slightly darker skin)
};

// ─── HEAD GRIDS (12 wide × 11 tall) ──────────────────────────────────────────

// Front face: gray cap, dark curly hair on sides, ROUND wire-frame glasses (G=frame, g=lens),
// skin face, subtle mouth. The glasses are the most important recognition feature.
const HEAD_FRONT = [
  "___CCCCCC___",  // cap dome
  "__CCCCCCCC__",  // cap dome
  "_CCCCCCCCCC_",  // cap dome
  "DDDDDDDDDDDD",  // baseball cap brim — full width
  "HHSSSSSSSSHH",  // hair + forehead
  "HHGgSSSgGHHH",  // glasses: G=thin wire frame, g=lens interior — round frames
  "HHGgSSSgGHHH",  // glasses row 2 — making them ROUND (2px tall)
  "HHHSSSSSnnHH",  // below lenses: cheeks (n=shadow), hair sides
  "HHHSSSSSSnnH",  // cheeks
  "_HHSSMSSnHH_",  // lips — single M pixel, n=chin shadow
  "__HSSSSSHH__",  // chin
];

// Back of head: cap + dark curly hair, neck visible at bottom
const HEAD_BACK = [
  "___CCCCCC___",
  "__CCCCCCCC__",
  "_CCCCCCCCCC_",
  "DDDDDDDDDDDD",  // brim
  "HHHHHHHHHHHH",  // all hair from behind
  "HHHHHHHHHHHH",
  "_HHHHHHHHHH_",
  "_HHSSSSSSHH_",  // back of neck skin visible
  "__HSSSSSSSH_",
  "__HSSSSSSSH_",
  "___HSSSSSH__",
];

// Right side profile: cap brim extends right, dark hair on left,
// round glasses side-on, subtle cheek and jaw
const HEAD_RIGHT = [
  "___CCCCCC___",  // cap top
  "__CCCCCCCCC_",  // cap
  "__CCCCCCCCC_",  // cap
  "_DDDDDDDDDDD",  // brim extends right (profile view)
  "HHHSSSSSSS__",  // hair (curly) left, skin right
  "HHHSGgGSSSS_",  // glasses from side: GgG = frame-lens-frame
  "HHHSGgGSSMS_",  // glasses row 2 + mouth corner hint (M=subtle)
  "HHHHSSSSSSn_",  // cheek (n=shadow under jaw)
  "_HHHHSSSnnn_",  // jaw with shadow
  "_HHHHSSSnnn_",  // chin
  "__HHHSSSn___",  // neck
];

// ─── BODY GRIDS (12 wide × 9 tall) ───────────────────────────────────────────

// Standing (front): hands at sides, standing still
const BODY_STAND_FRONT = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBbB_",
  "_SbBBBBBBbS_",  // hands (S=skin showing)
  "__PPPPPPPP__",
  "__PP____PP__",
  "__PP____PP__",
  "__KK____KK__",
];

// Run front frame A: legs spread wide
const BODY_RUN_FRONT_A = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_SbBBBBBBbB_",
  "__BBBBBBBbS_",
  "_SPPPPPPPP__",  // arm swings
  "PPP______PPP",
  "_PP______PP_",
  "_KK______KK_",
];

// Run front frame B: legs crossing (mid-stride)
const BODY_RUN_FRONT_B = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBbS_",
  "_SbBBBBBBB__",
  "__PPPPPPPP_S",  // arm swings other side
  "___PP__PP___",
  "___PP__PP___",
  "___KK__KK___",
];

// Run right frame A: side stride, arm forward
const BODY_RUN_RIGHT_A = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BBBBBBBBSb_",  // arm extends forward (right)
  "_BBBBBBBBB__",
  "_BBBBBBBBB__",
  "__PPPPPPPP__",
  "PPP_____PP__",  // stride wide
  "_PP_____PP__",
  "_KK_____KK__",
];

// Run right frame B: side stride, other phase
const BODY_RUN_RIGHT_B = [
  "__BBBBBBBB__",
  "_BBBBBBBBBB_",
  "_BBBBBBBBSb_",
  "_BBBBBBBBB__",
  "_BBBBBBBBB__",
  "__PPPPPPPP__",
  "____PPPPP___",
  "____PPPP____",
  "_KKK_KKK____",  // feet cross
];

// Wave: one arm raised (right side arm up)
const BODY_WAVE = [
  "_BBBBBBBBBS_",  // arm raised up-right (S=hand skin)
  "_BBBBBBBBBb_",
  "_BbBBBBBBbB_",
  "_BbBBBBBBB__",
  "_SbBBBBBBB__",
  "__PPPPPPPP__",
  "__PP____PP__",
  "__PP____PP__",
  "__KK____KK__",
];

// Sleeping: top-down lying pose — head on left, body/legs on right (24 wide × 8 tall)
const SLEEPING = [
  "________________________",
  "___CCCCC____BBBBBBBBB___",
  "__CCCCCCC__BBBBBBBBBBB__",
  "__HSSSSSH__BBBBBBBBBBBB_",
  "__HSGgSSH__BBBBBBBBBBBB_",
  "__HSSMSSH__PPPPPPPPPKK__",
  "___HHHHH____PPPPPPPPK___",
  "________________________",
];

const OVERLAY_EXCLAIM = ["W_", "W_", "__", "W_"];
const OVERLAY_Z = ["WWW", "__W", "_W_", "WWW"];

// === Row-length validation guard ===
const GRIDS = {
  HEAD_FRONT,
  HEAD_BACK,
  HEAD_RIGHT,
  BODY_STAND_FRONT,
  BODY_RUN_FRONT_A,
  BODY_RUN_FRONT_B,
  BODY_RUN_RIGHT_A,
  BODY_RUN_RIGHT_B,
  BODY_WAVE,
  SLEEPING,
  OVERLAY_EXCLAIM,
  OVERLAY_Z,
};
for (const [name, grid] of Object.entries(GRIDS)) {
  const widths = grid.map((row) => row.length);
  const unique = [...new Set(widths)];
  if (unique.length > 1) {
    throw new Error(
      `Grid "${name}" has rows of unequal length: ${JSON.stringify(widths)}`
    );
  }
}

const SHEET_W = 256, SHEET_H = 128, CELL = 32;
const sheet = new Uint8Array(SHEET_W * SHEET_H * 4);

function drawGrid(grid, x0, y0, { mirror = false } = {}) {
  const h = grid.length, w = grid[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y][mirror ? w - 1 - x : x];
      const rgba = PALETTE[ch];
      if (!rgba) continue;
      const px = x0 + x, py = y0 + y;
      if (px < 0 || py < 0 || px >= SHEET_W || py >= SHEET_H) continue;
      sheet.set(rgba, (py * SHEET_W + px) * 4);
    }
  }
}

function drawCharacter(col, row, head, body, { mirror = false, bob = 0, overlay = null, overlayAt = [24, 2] } = {}) {
  const x0 = col * CELL + 10, y0 = row * CELL + 6 + bob;
  drawGrid(head, x0, y0, { mirror });
  drawGrid(body, x0, y0 + 11, { mirror });
  if (overlay) drawGrid(overlay, col * CELL + overlayAt[0], row * CELL + overlayAt[1]);
}

function drawSleeping(col, row, zOffset) {
  drawGrid(SLEEPING, col * CELL + 4, row * CELL + 16);
  drawGrid(OVERLAY_Z, col * CELL + 22 + zOffset, row * CELL + 6 + zOffset);
}

// ─── idle / alert / tired ────────────────────────────────────────────────────
drawCharacter(3, 3, HEAD_FRONT, BODY_STAND_FRONT);
drawCharacter(7, 3, HEAD_FRONT, BODY_STAND_FRONT, { overlay: OVERLAY_EXCLAIM });
drawCharacter(3, 2, HEAD_FRONT, BODY_STAND_FRONT, { bob: 2, overlay: OVERLAY_Z });

// ─── sleeping ────────────────────────────────────────────────────────────────
drawSleeping(2, 0, 0);
drawSleeping(2, 1, 2);

// ─── wave (scratchSelf) ───────────────────────────────────────────────────────
drawCharacter(5, 0, HEAD_FRONT, BODY_WAVE);
drawCharacter(6, 0, HEAD_FRONT, BODY_STAND_FRONT);
drawCharacter(7, 0, HEAD_FRONT, BODY_WAVE);

// ─── stretch toward walls ─────────────────────────────────────────────────────
drawCharacter(0, 0, HEAD_BACK,  BODY_WAVE);
drawCharacter(0, 1, HEAD_BACK,  BODY_STAND_FRONT);
drawCharacter(7, 1, HEAD_FRONT, BODY_WAVE);
drawCharacter(6, 2, HEAD_FRONT, BODY_STAND_FRONT);
drawCharacter(2, 2, HEAD_RIGHT, BODY_WAVE);
drawCharacter(2, 3, HEAD_RIGHT, BODY_STAND_FRONT);
drawCharacter(4, 0, HEAD_RIGHT, BODY_WAVE, { mirror: true });
drawCharacter(4, 1, HEAD_RIGHT, BODY_STAND_FRONT, { mirror: true });

// ─── runs ─────────────────────────────────────────────────────────────────────
drawCharacter(1, 2, HEAD_BACK, BODY_RUN_FRONT_A);
drawCharacter(1, 3, HEAD_BACK, BODY_RUN_FRONT_B, { bob: 1 });
drawCharacter(6, 3, HEAD_FRONT, BODY_RUN_FRONT_A);
drawCharacter(7, 2, HEAD_FRONT, BODY_RUN_FRONT_B, { bob: 1 });
drawCharacter(3, 0, HEAD_RIGHT, BODY_RUN_RIGHT_A);
drawCharacter(3, 1, HEAD_RIGHT, BODY_RUN_RIGHT_B, { bob: 1 });
drawCharacter(4, 2, HEAD_RIGHT, BODY_RUN_RIGHT_A, { mirror: true });
drawCharacter(4, 3, HEAD_RIGHT, BODY_RUN_RIGHT_B, { mirror: true, bob: 1 });

// ─── diagonals (reuse nearest cardinal art) ───────────────────────────────────
drawCharacter(0, 2, HEAD_BACK, BODY_RUN_FRONT_A);
drawCharacter(0, 3, HEAD_BACK, BODY_RUN_FRONT_B, { bob: 1 });
drawCharacter(1, 0, HEAD_BACK, BODY_RUN_FRONT_A);
drawCharacter(1, 1, HEAD_BACK, BODY_RUN_FRONT_B, { bob: 1 });
drawCharacter(5, 1, HEAD_RIGHT, BODY_RUN_RIGHT_A);
drawCharacter(5, 2, HEAD_RIGHT, BODY_RUN_RIGHT_B, { bob: 1 });
drawCharacter(5, 3, HEAD_RIGHT, BODY_RUN_RIGHT_A, { mirror: true });
drawCharacter(6, 1, HEAD_RIGHT, BODY_RUN_RIGHT_B, { mirror: true, bob: 1 });

const raw = { raw: { width: SHEET_W, height: SHEET_H, channels: 4 } };
await sharp(Buffer.from(sheet), raw).png().toFile("public/mini-dogan.png");
await sharp(Buffer.from(sheet), raw)
  .resize(SHEET_W * 8, SHEET_H * 8, { kernel: "nearest" })
  .png()
  .toFile("../../docs/superpowers/specs/assets/sprite-preview.png");
console.log("Wrote public/mini-dogan.png and sprite-preview.png");
