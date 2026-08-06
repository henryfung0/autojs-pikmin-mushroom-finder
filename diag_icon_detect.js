"auto";

/**
 * TEMP DIAGNOSTIC SCRIPT — delete after diagnosis. NOT part of the app.
 *
 * Why it exists: the launch flow logs "pikmin icon1 / pikmin icon1.1 not found"
 * even though both templates load fine. This script answers WHICH problem it is:
 *
 *   (A) TIMING problem  → scores stay low (~0.3-0.5) for many seconds, then jump
 *                         to 0.8+ once the game finally finishes loading.
 *                         → fix = keep scanning longer / retry later.
 *   (B) TEMPLATE problem → scores NEVER go above ~0.5 for the full 40s even when
 *                         the icon IS visible on screen.
 *                         → fix = recapture template or lower threshold.
 *   (C) CAPTURE problem  → "captureScreen() returned null" lines.
 *                         → fix = grant screen-capture permission.
 *
 * HOW TO RUN:
 *   1. Fully close Pikmin Bloom (swipe it away / force stop).
 *   2. Run this script in AutoJS6. It auto-launches the game and captures
 *      one frame every 2s for ~40s (20 frames).
 *   3. When it logs "DIAG: done" (~45s), copy the ENTIRE log back to me.
 *   4. If it saved files under /sdcard/PikminDiag/, send those too.
 */

var AUTO_LAUNCH = true;                 // set false to run on a screen you open yourself
var PACKAGE     = "com.nianticlabs.pikmin";
var iconDir     = files.join(files.cwd(), "templates", "icon");
var outDir      = "/sdcard/PikminDiag";
var WANTED      = ["pikmin icon1.jpg", "pikmin icon1.1.jpg"];

var FRAMES = 20;   // ~40s total
var GAP_MS = 2000;
var SAVE_IF_SCORE_AT_LEAST = 0.5;   // save frames only when something may match

files.ensureDir(outDir);

// ---- request screen capture permission ----
try {
  if (!images.requestScreenCapture(false)) {
    toast("Screen capture permission DENIED. Grant it and rerun.");
    exit();
  }
} catch (e) {
  console.log("DIAG: requestScreenCapture threw: " + e);
}

// ---- load icon templates (case-insensitive, mirrors lib/pikmin_icon.js) ----
var tpls = [];
var names = [];
try {
  names = files.listDir(iconDir) || [];
} catch (e) {
  toast("Cannot list " + iconDir + ": " + e);
  exit();
}
for (var i = 0; i < names.length; i++) {
  var n = names[i];
  if (typeof n !== "string") continue;
  if (WANTED.indexOf(n.toLowerCase()) === -1) continue;
  var img = null;
  try {
    img = images.read(files.join(iconDir, n));
  } catch (e) {
    img = null;
  }
  if (img && img.getWidth() > 0) {
    tpls.push({ name: n, image: img, w: img.getWidth(), h: img.getHeight() });
  }
}
if (tpls.length === 0) {
  toast("No icon templates found in: " + iconDir);
  exit();
}
var tplDesc = tpls.map(function (t) { return t.name + " (" + t.w + "x" + t.h + ")"; }).join(", ");
console.log("DIAG: loaded " + tplDesc);

// ---- best-match score of one template against one frame ----
function bestScore(img, tpl) {
  var region = [0, 0, img.getWidth(), img.getHeight()];

  // Preferred: matchTemplate (AutoJS6) returns the raw score directly.
  try {
    if (typeof images.matchTemplate === "function") {
      var res = images.matchTemplate(img, tpl.image, {
        threshold: 0.2,
        region: region,
        max: 1
      });
      if (res && res.length > 0 && typeof res[0].score === "number") {
        return {
          score: Math.round(res[0].score * 1000) / 1000,
          x: Math.round(res[0].x + tpl.w / 2),
          y: Math.round(res[0].y + tpl.h / 2)
        };
      }
    }
  } catch (e) { /* fall through to binary search */ }

  // Fallback: binary-search the threshold with findImage (guaranteed API).
  var lo = 0.25, hi = 0.95, best = -1, bestPt = null;
  for (var s = 0; s < 7; s++) {
    var mid = Math.round(((lo + hi) / 2) * 1000) / 1000;
    var p = null;
    try {
      p = images.findImage(img, tpl.image, { threshold: mid, region: region });
    } catch (e) {
      p = null;
    }
    if (p) { best = mid; bestPt = p; lo = mid; } else { hi = mid; }
  }
  return {
    score: best,
    x: bestPt ? Math.round(bestPt.x + tpl.w / 2) : -1,
    y: bestPt ? Math.round(bestPt.y + tpl.h / 2) : -1
  };
}

// ---- main capture loop ----
if (AUTO_LAUNCH) {
  console.log("DIAG: launching " + PACKAGE + "...");
  app.launchPackage(PACKAGE);
}

var savedAny = false;
for (var f = 0; f < FRAMES; f++) {
  var cap = null;
  try {
    cap = captureScreen();
  } catch (e) {
    cap = null;
  }
  if (!cap) {
    console.log("DIAG: frame " + f + ": captureScreen() returned null — capture permission problem?");
    sleep(GAP_MS);
    continue;
  }

  var line = "DIAG: frame " + f + " (" + cap.getWidth() + "x" + cap.getHeight() + "):";
  var bestVal = -1, bestInfo = null, bestTplName = "";
  for (var t = 0; t < tpls.length; t++) {
    var m = bestScore(cap, tpls[t]);
    line += " " + tpls[t].name + "=" + m.score;
    if (m.score > bestVal) {
      bestVal = m.score;
      bestInfo = m;
      bestTplName = tpls[t].name;
    }
  }
  if (bestVal >= 0.5) {
    line += "  -> best " + bestTplName + " @ (" + bestInfo.x + "," + bestInfo.y + ") score " + bestVal;
  }
  console.log(line);

  if (bestVal >= SAVE_IF_SCORE_AT_LEAST) {
    var framePath = files.join(outDir, "frame_" + f + ".png");
    try {
      images.save(cap, framePath);
      console.log("DIAG: saved " + framePath);
      savedAny = true;
    } catch (e) {
      console.log("DIAG: save failed: " + e);
    }
  }

  cap.recycle();
  sleep(GAP_MS);
}

for (var r = 0; r < tpls.length; r++) {
  try {
    tpls[r].image.recycle();
  } catch (e) {}
}

console.log("DIAG: done. Best score never reached 0.5 = " + (!savedAny) + " (if true → TEMPLATE mismatch, not timing)");
