/*===========================================================================
  capture.js – lightweight PNG-frame recorder for p5.js sketches
  ---------------------------------------------------------------------------
  • Requires JSZip 3.x  +  FileSaver.js 2.x (add script tags in HTML)
  • Press your chosen key (e.g. "r") to record REC_SECONDS seconds at
    the sketch's current frameRate().
  • Frames are placed in a dated sub-folder inside a single ZIP download.
===========================================================================*/

// ────────────────────────────── configuration ─────────────────────────────
window.recPending = false; 

const REC_SECONDS = 10;          // duration to record
const REC_FPS     = 60;          // expected frame-rate (match frameRate())
const REC_FRAMES  = REC_SECONDS * REC_FPS;

// ───────────────────────────── internal state ─────────────────────────────
let recPending = false;          // recording in progress?
let grabCount  = 0;              // how many frames captured so far
let zip, folder;                 // JSZip objects

// ───────────────────────────── public API ─────────────────────────────────
/** Call once (e.g. key press) to begin recording. */
function startCapture () {
  if (recPending) return;        // already recording

  console.log("▶ recording started");
  recPending = true;
  grabCount  = 0;

  zip    = new JSZip();
  folder = zip.folder(timeStamp("frames"));
}

/** Call every draw() while `recPending` is true */
function saveGifFrame () {
  if (!recPending) return;

  // get the p5 canvas element – p5 exposes it as the global variable `canvas`
  const img  = canvas.toDataURL("image/png");
  const name = `frame_${String(grabCount).padStart(4, "0")}.png`;

  // strip the leading "data:image/png;base64," and store only the base64 data
  folder.file(name, img.split(",")[1], { base64: true });

  grabCount++;
  if (grabCount >= REC_FRAMES) finishCapture();
}

// ─────────────────────────── finish + download ZIP ────────────────────────
function finishCapture () {
  if (!recPending) return;
  recPending = false;

  console.log("■ recording finished – generating zip…");
  zip.generateAsync({ type: "blob" }).then(blob => {
    saveAs(blob, `${folder.name}.zip`);  // triggers browser download
    console.log("✓ download ready");
  });
}

// ──────────────────────────── utility helpers ─────────────────────────────
function timeStamp (prefix = "") {
  const d   = new Date();
  const pad = n => String(n).padStart(2, "0");
  const ts  = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
              `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return prefix ? `${prefix}_${ts}` : ts;
}

// make functions global (so they’re visible to the main sketch)
window.startCapture  = startCapture;
window.saveGifFrame  = saveGifFrame;
window.finishCapture = finishCapture;
