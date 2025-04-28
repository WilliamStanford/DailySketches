/**
 * p5.js – Ribbon-Extrusion Random-Walk with travelling pulse
 * ----------------------------------------------------------
 * – Builds a chain of touching circles that starts on a canvas edge
 * – Stops once ≥ 30 circles & the last one crosses the canvas boundary
 * – Converts contacts into outline-arc segments
 * – Renders as an opaque 3-D ribbon:
 *       black body  +  white outline (fading with depth)
 * – One slice at a time lights up turquoise (α = 255) and marches “backward”
 */

// ───────────────────────────────────────────── Globals & parameters ──────────

let circles = [];           // chain of circle objects
let arcs    = [];           // outline segments extracted from the chain

const FPS = 60;   
let grabbedYet   = false;

const CANVAS_W  = 1080;
const CANVAS_H  = 1080; 
  
const MIN_R     = 50;
const MAX_R     = 200; 

const LAYERS    = 220;        // depth slices
const STEP_X    = -1;         // per-slice drift
const STEP_Y    =  1;

const WHITE_W   = 2;          // highlight stroke weight
const BLACK_W   = 3;          // ribbon body – must exceed slice gap

const TICK      = 1;        // frames each slice stays lit (speed of pulse)
  
// ──────────────────────────────────────────────────────────── p5 setup ──────
function setup () {
  frameRate(FPS);
  createCanvas(CANVAS_W, CANVAS_H);
  generateTouchingCircles();
  buildArcList();
}

// ───────────────────────────────────────────────────────────── main draw ────
function draw () {
  background(0);
  noFill();

  // which layer is “lit” this frame?
  const activeLayer = (floor(frameCount / TICK) % LAYERS);   // 0 = nearest

  // paint far→near so nearer slices cover the far ones
  for (let layer = LAYERS - 1; layer >= 0; layer--) {
    push();
    translate(layer * STEP_X, layer * STEP_Y);

    /* 1) opaque black body */
    stroke(0);
    strokeWeight(BLACK_W);
    for (const seg of arcs) drawArcSegment(seg);

    /* 2) highlight */
    if (layer === activeLayer) {
      // turquoise pulse – fully opaque
      stroke(0, 255, 255, 255);
    } else {
      // normal white fade with depth
      const alpha = lerp(255, 0, layer / (LAYERS - 1))- 25;
      stroke(255, alpha);
    }
    strokeWeight(WHITE_W);
    for (const seg of arcs) drawArcSegment(seg);

    pop();
  }
  if (window.recPending) saveGifFrame();   // from capture.js
}

// ───────────────────────────────────────── outline-arc construction ─────────
function buildArcList () {
  arcs.length = 0;
  if (circles.length < 2) return;

  // edge → circle-1 contact
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

// ─────────────────────────────── utility: draw a single arc segment ─────────
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

// ──────────────────────────────── circle-chain generator (unchanged) ────────
function generateTouchingCircles () {
  circles.length = 0;

  const edge = floor(random(4));
  const r0   = random(MIN_R, MAX_R);
  const x0   = (edge === 1) ? width  - r0 :
               (edge === 3) ? r0 :
               random(r0, width  - r0);
  const y0   = (edge === 0) ? r0 :
               (edge === 2) ? height - r0 :
               random(r0, height - r0);
  circles.push({x:x0, y:y0, radius:r0, edge});

  const MAX_ATTEMPTS = 8000, MAX_CIRCLES = 150;
  let attempts = 0;

  while (++attempts < MAX_ATTEMPTS && circles.length < MAX_CIRCLES) {
    const last = circles[circles.length - 1];
    const newR = random(MIN_R, MAX_R);

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

/* pick an angle that tries to keep the next circle inside */
function safeAngle (c) {
  let minA = 0, maxA = TWO_PI;
  if (c.x - c.radius <= 0)          { minA = -HALF_PI; maxA =  HALF_PI; }
  else if (c.x + c.radius >= width) { minA =  HALF_PI; maxA =  PI+HALF_PI; }
  if (c.y - c.radius <= 0)          { minA = max(minA, 0);   maxA = min(maxA, PI); }
  else if (c.y + c.radius >= height){ minA = max(minA, PI);  maxA = min(maxA, TWO_PI); }
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

// ───────────────────────────── save on “s” key (lossless PNG) ───────────────
// ───────────────────────────── save / record keys ────────────
function keyPressed () {

  /* NEW – press R to record a 10-s PNG sequence into one .zip */
  if((key === 'R') && !window.recPending) {
    startCapture();                         // function from capture.js
  }

  /* your old one-shot image (Z) still works */
  if (key === 'Z') {
    const d  = new Date();
    const ts = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    saveCanvas(`${ts}`, 'jpg', 1.0);
  }
}
  