/**
 * p5.js – Ribbon-Extrusion Random-Walk
 * ------------------------------------
 * • Builds a chain of touching circles that starts on a canvas edge
 *   and grows until BOTH conditions are true:
 *     – the chain has ≥ 30 circles
 *     – the *last* circle extends outside the canvas
 * • Converts those contacts into outline-arc segments
 * • Renders the outline as an opaque 3-D ribbon:
 *     – thick black stroke (erases what’s behind)
 *     – thin white stroke on top (visible highlight)
 */

// ─────────────────────────────────────────────────── Globals & paramet
// ers ────  
let circles = [];        // chain of circle objects
let arcs    = [];        // outline segments extracted from the chain

const CANVAS_W  = 1080;
const CANVAS_H  = 1080; 
  
const MIN_R     = 50;
const MAX_R     = 200; 

const LAYERS    = 220;        // depth slices
const STEP_X    = -1;         // per-slice drift
const STEP_Y    =  1;

const WHITE_W   = 2;          // highlight stroke weight
const BLACK_W   = 3;          // ribbon body – must exceed slice gap

// ──────────────────────────────────────────────────────────────── p5 setup ──
function setup () {
  createCanvas(CANVAS_W, CANVAS_H);
  generateTouchingCircles();
  buildArcList();
}

// ────────────────────────────────────────────────────────────── main draw ───
function draw () {
  background(0);
  noFill();

  // paint far-to-near so nearer slices cover the far ones
  for (let layer = LAYERS - 1; layer >= 0; layer--) {
    push();
    translate(layer * STEP_X, layer * STEP_Y);

    // 1) opaque black body
    stroke(0);
    strokeWeight(BLACK_W);
    for (const seg of arcs) drawArcSegment(seg);

    /* 2) white highlight with depth-based fade:
          layer = 0   → alpha 255 (nearest)
          layer = L-1 → alpha   0 (furthest) */
    const t     = layer / (LAYERS - 1);          // 0..1
    const alpha = lerp(255, 0, t);               // near→far
    stroke(255, alpha);
    strokeWeight(WHITE_W);
    for (const seg of arcs) drawArcSegment(seg);

    pop();
  }
}

// ─────────────────────────────────────────────── outline-arc construction ───
function buildArcList () {
  arcs.length = 0;
  if (circles.length < 2) return;

  // edge ➜ circle-1 contact
  const c0 = circles[0], c1 = circles[1];
  const edgeAngle = [ -HALF_PI, 0, HALF_PI, PI ][c0.edge];
  const toSecond  = atan2(c1.y - c0.y, c1.x - c0.x);
  arcs.push({cx:c0.x, cy:c0.y, r:c0.radius, a1:edgeAngle, a2:toSecond, cw:true});

  // chain contacts
  for (let i = 1; i < circles.length - 1; i++) {
    const prev = circles[i-1], cur = circles[i], nxt = circles[i+1];
    const a1 = atan2(cur.y - prev.y, cur.x - prev.x) + PI;
    const a2 = atan2(nxt.y - cur.y,  nxt.x - cur.x);
    arcs.push({cx:cur.x, cy:cur.y, r:cur.radius, a1, a2, cw:(i % 2 === 0)});
  }
}

// ───────────────────────────────────────────── utility: draw a single arc ───
function drawArcSegment ({cx, cy, r, a1, a2, cw}) {
  // wrap angles to 0..TWO_PI
  a1 = (a1 % TWO_PI + TWO_PI) % TWO_PI;
  a2 = (a2 % TWO_PI + TWO_PI) % TWO_PI;

  if (cw) {           // clockwise (p5 default)
    if (a2 <= a1) a2 += TWO_PI;
    arc(cx, cy, r*2, r*2, a1, a2);
  } else {            // counter-clockwise
    if (a1 <= a2) a1 += TWO_PI;
    arc(cx, cy, r*2, r*2, a2, a1);
  }
}

// ───────────────────────────────────────────────── circle-chain generator ───
function generateTouchingCircles () {
  circles.length = 0;                               // fresh start

  /* ── first circle touches a random edge ─────────────────────────────── */
  const edge = floor(random(4));
  const r0   = random(MIN_R, MAX_R);
  const x0   = (edge === 1) ? width  - r0 :
               (edge === 3) ? r0 :
               random(r0, width  - r0);
  const y0   = (edge === 0) ? r0 :
               (edge === 2) ? height - r0 :
               random(r0, height - r0);
  circles.push({x:x0, y:y0, radius:r0, edge});

  /* ── grow until ≥30 circles *and* last is outside ───────────────────── */
  const MAX_ATTEMPTS = 8000, MAX_CIRCLES = 150;
  let attempts = 0;

  while (++attempts < MAX_ATTEMPTS && circles.length < MAX_CIRCLES) {
    const last = circles[circles.length - 1];
    const newR = random(MIN_R, MAX_R);

    // while <30, keep chain inside; afterwards shoot anywhere
    const ang  = (circles.length < 30) ? safeAngle(last) : random(TWO_PI);
    const dist = last.radius + newR;
    const nx   = last.x + cos(ang) * dist;
    const ny   = last.y + sin(ang) * dist;
    const next = {x:nx, y:ny, radius:newR};

    if (overlapsAny(next)) continue;
    circles.push(next);

    if (circles.length >= 30 && isOutside(next)) break;
  }
}

/* choose an angle that *tries* to keep the next circle inside */
function safeAngle (c) {
  let minA = 0, maxA = TWO_PI;

  if (c.x - c.radius <= 0)          { minA = -HALF_PI; maxA =  HALF_PI; }
  else if (c.x + c.radius >= width) { minA =  HALF_PI; maxA =  PI+HALF_PI; }

  if (c.y - c.radius <= 0) {
    minA = max(minA, 0);            maxA = min(maxA, PI);
  } else if (c.y + c.radius >= height) {
    minA = max(minA, PI);           maxA = min(maxA, TWO_PI);
  }
  return random(minA, maxA);
}

/* helpers */
function overlapsAny (nc) {
  return circles.some(c => dist(c.x, c.y, nc.x, nc.y) < c.radius + nc.radius);
}
function isOutside (c) {
  return (c.x - c.radius < 0 || c.x + c.radius > width ||
          c.y - c.radius < 0 || c.y + c.radius > height);
}

// ─── save on “s” key ─────────────────────────────────────────────────────────
function keyPressed () {
  if (key === 's' || key === 'S') {
    // build YYYY-MM-DD with leading zeros
    const now  = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    const stamp = `${yyyy}-${mm}-${dd}`;

    /* p5.js save — the browser will download a PNG.
       The filename will be “images_YYYY-MM-DD.png”.  */
       saveCanvas(`${stamp}`, 'jpg', 1.0);  
  }
}