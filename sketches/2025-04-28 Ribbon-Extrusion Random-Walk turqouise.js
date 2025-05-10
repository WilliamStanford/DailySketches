/**
 * p5.js – Ribbon‑Extrusion Random‑Walk (perspective version)
 * ----------------------------------------------------------
 * • Builds a chain of touching circles:
 *      – first circle sits half‑inside the frame
 *      – DFS/back‑tracking until ≥ 5 circles are wholly outside the canvas
 * • Recentres + rescales once so every visible arc fits a 1080×1080 viewport
 * • Renders the ribbon as a one‑point‑perspective “slice stack”
 *      – black body + white fading outline
 *      – travelling turquoise pulse
 */

let circles = [];        // circle chain
let arcs    = [];        // outline segments

/* ───── globals & parameters ────────────────────────────────────────────── */
const FPS         = 60;

const CANVAS_W    = 1080;      // actual p5 canvas
const CANVAS_H    = 1080;

const VIEWPORT    = 1080;      // promised no‑clip zone
const VIEW_PAD    = 20;        // margin inside viewport

const MIN_R       = 50;
const MAX_R       = 200;

const LAYERS      = 220;       // depth slices
const DEPTH_SCALE = 0.99;      // shrink factor per slice

const BLACK_W     = 2;         // ribbon body stroke
const WHITE_W     = 1;         // outline stroke

const GAP         = 6;         // layers between turquoise pulses
const TICK        = 1;         // frames each slice stays lit

const MAX_ANGLES_TRIED = 64;    // from 18  →  denser fan‑out
const failsSinceOutsideLimit = 16; // from 3   →  deeper exploration


/* ───── p5: setup ───────────────────────────────────────────────────────── */
function setup () {
  frameRate(FPS);
  createCanvas(CANVAS_W, CANVAS_H);

  generateTouchingCircles();   // DFS w/ back‑tracking
  fitRibbonToViewport();       // centre + scale into 1080×1080
  fillVoids();
  buildArcList();              // extract arc segments
}

/* ───── p5: draw ────────────────────────────────────────────────────────── */
function draw () {
  background(0);
  noFill();

  const leader = floor(frameCount / TICK) % LAYERS;
  const pulses = floor(leader / GAP) + 1;

  for (let layer = LAYERS - 1; layer >= 0; layer--) {
    push();

    /* one‑point perspective transform */
    translate(width / 2, height / 2);
    const s = Math.pow(DEPTH_SCALE, layer);
    scale(s);

    /* keep strokes visually constant */
    const bodyW    = BLACK_W  / s;
    const outlineW = WHITE_W  / s;

    /* opaque ribbon body */
    stroke(0);
    strokeWeight(bodyW);
    for (const seg of arcs) drawArcSegment(seg);

    /* turquoise pulse logic */
    const diff      = leader - layer;
    const turquoise = diff >= 0 && diff % GAP === 0 && diff / GAP < pulses;

    strokeWeight(outlineW);
    if (turquoise) {
      stroke(0, 255, 255, 255);
    } else {
      const alpha = lerp(255, 0, layer / (LAYERS - 1)) - 25;
      stroke(255, alpha);
    }
    for (const seg of arcs) drawArcSegment(seg);

    pop();
  }

  if (window.recPending) saveGifFrame();   // optional capture.js hook
}

/* ───── outline‑arc construction ───────────────────────────────────────── */
function buildArcList () {
  arcs.length = 0;
  if (circles.length < 2) return;

  const c0 = circles[0], c1 = circles[1];
  const edgeAngle = [ -HALF_PI, 0, HALF_PI, PI ][c0.edge];
  const toSecond  = atan2(c1.y - c0.y, c1.x - c0.x);
  arcs.push({cx:c0.x, cy:c0.y, r:c0.radius, a1:edgeAngle, a2:toSecond, cw:true});

  for (let i = 1; i < circles.length - 1; i++) {
    const prev = circles[i-1], cur = circles[i], nxt = circles[i+1];
    const a1 = atan2(cur.y - prev.y, cur.x - prev.x) + PI;
    const a2 = atan2(nxt.y - cur.y,  nxt.x - cur.x);
    arcs.push({cx:cur.x, cy:cur.y, r:cur.radius, a1, a2, cw:(i % 2 === 0)});
  }
}

/* ───── arc renderer (shift to eye‑point) ───────────────────────────────── */
function drawArcSegment ({cx, cy, r, a1, a2, cw}) {
  cx -= width  / 2;
  cy -= height / 2;

  a1 = (a1 % TWO_PI + TWO_PI) % TWO_PI;
  a2 = (a2 % TWO_PI + TWO_PI) % TWO_PI;

  if (cw) { if (a2 <= a1) a2 += TWO_PI; arc(cx, cy, r*2, r*2, a1, a2); }
  else    { if (a1 <= a2) a1 += TWO_PI; arc(cx, cy, r*2, r*2, a2, a1); }
}

/* ───── DFS circle‑chain generator with back‑tracking ───────────────────── */
function fullyOutside (c) {
  return (
    c.x + c.radius < 0            ||
    c.x - c.radius > CANVAS_W     ||
    c.y + c.radius < 0            ||
    c.y - c.radius > CANVAS_H
  );
}

function overlapsAny (nc) {
  return circles.some(
    c => dist(c.x, c.y, nc.x, nc.y) < c.radius + nc.radius - 0.1   // −ε
  );
}

function generateTouchingCircles() {
  circles.length = 0;

  /* 1 — seed: half‑inside on a random edge */
  const edge = floor(random(4));          // 0=top 1=right 2=bottom 3=left
  const r0   = random(MIN_R, MAX_R);

  const x0 = (edge === 1) ? CANVAS_W - r0 * 0.5 :
             (edge === 3) ? r0 * 0.5             :
             random(r0 * 0.5, CANVAS_W - r0 * 0.5);
  const y0 = (edge === 0) ? r0 * 0.5             :
             (edge === 2) ? CANVAS_H - r0 * 0.5   :
             random(r0 * 0.5, CANVAS_H - r0 * 0.5);

  circles.push({ x: x0, y: y0, radius: r0, edge });

  /* 2 — DFS parameters */
  const MAX_CIRCLES      = 300;    // absolute hard cap
  const MAX_TOTAL_TRIES  = 40000;  // safety valve
  const ANGLE_STEP       = TWO_PI / 64;   // 5.625°
  const TARGET_OUTSIDE   = 5;

  let totalTries   = 0;
  let outsideCount = fullyOutside(circles[0]) ? 1 : 0;

  /* keep track of the best‑ever chain */
  let bestCircles   = circles.map(c => ({ ...c }));
  let bestOutsideCt = outsideCount;

  /* 3 — depth‑first search with back‑tracking */
  function dfs () {
    if (++totalTries > MAX_TOTAL_TRIES) return;

    /* record best chain so far */
    if (outsideCount >= TARGET_OUTSIDE && circles.length > bestCircles.length) {
      bestCircles   = circles.map(c => ({ ...c }));
      bestOutsideCt = outsideCount;
    }

    /* stop if we hit the absolute cap */
    if (circles.length >= MAX_CIRCLES) return;

    const last  = circles[circles.length - 1];
    const dist0 = last.radius;

    /* fan out around the tail in small angular increments */
    for (let ang = 0; ang < TWO_PI; ang += ANGLE_STEP) {
      const newR = random(MIN_R, MAX_R);
      const nx   = last.x + cos(ang) * (dist0 + newR);
      const ny   = last.y + sin(ang) * (dist0 + newR);
      const next = { x: nx, y: ny, radius: newR };

      if (overlapsAny(next)) continue;

      circles.push(next);
      if (fullyOutside(next)) outsideCount++;

      dfs();                             // recurse deeper

      /* back‑track */
      if (fullyOutside(next)) outsideCount--;
      circles.pop();
    }
  }

  dfs();                                 // launch the exhaustive search

  /* 4 — restore the longest chain found */
  circles.length = 0;
  for (const c of bestCircles) circles.push(c);
}

/* ───── centre + scale chain into 1080×1080 viewport ───────────────────── */
function fitRibbonToViewport () {
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (const c of circles) {
    minX = min(minX, c.x - c.radius);
    maxX = max(maxX, c.x + c.radius);
    minY = min(minY, c.y - c.radius);
    maxY = max(maxY, c.y + c.radius);
  }
  const bw = maxX - minX;
  const bh = maxY - minY;
  const limit = VIEWPORT - VIEW_PAD * 2;
  const scale = min(1, min(limit / bw, limit / bh));

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;

  for (const c of circles) {
    c.x = (c.x - cx) * scale + CANVAS_W * 0.5;
    c.y = (c.y - cy) * scale + CANVAS_H * 0.5;
    c.radius *= scale;
  }
}

function fillVoids (attempts = 2000) {
  while (attempts--) {
    const r   = random(12, 30);
    const nx  = random(CANVAS_W), ny = random(CANVAS_H);
    const c   = {x:nx, y:ny, radius:r};

    if (overlapsAny(c)) continue;
    if (!fullyInsideViewport(c)) continue;   // helper that checks 1080 box

    circles.push(c);               // a filler circle – no need to be outside
  }
}

/* ───── save / record keys (optional) ──────────────────────────────────── */
function keyPressed () {
  if (key === 'R' && !window.recPending) startCapture();
  if (key === 'Z') {
    const d  = new Date();
    const ts = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    saveCanvas(`${ts}`, 'jpg', 1.0);
  }
}
