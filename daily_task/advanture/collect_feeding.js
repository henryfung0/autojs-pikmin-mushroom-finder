/**
 * advanture/collect_feeding.js — Collect feeding items after adventure flow
 *
 * Flow:
 *   1. Click "Feeding page.jpg" to open the feeding page
 *   2. Loop: capture screen → check for collect templates → click if found
 *   3. When no collect templates found → break loop
 *   4. Double-click "Feeding page.jpg" to close the feeding page
 *
 * Exports:
 *   runCollectFeeding(config, panel)  → void
 */

"auto";

var floatyMod = require("../../ui/floaty");

// ---------------------------------------------------------------------------
// Internal helpers (duplicated per-module pattern — see advanture_flow.js)
// ---------------------------------------------------------------------------

function _loadTemplatesFromDir(baseDir, subDir) {
  var dir = files.join(baseDir, subDir);
  var entries = [];
  try {
    entries = files.listDir(dir, function(name) {
      if (typeof name !== "string") return false;
      var lower = name.toLowerCase();
      return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
    });
  } catch (e) {
    console.warn("collect_feeding: cannot list '" + dir + "': " + e);
    return [];
  }

  var templates = [];
  for (var i = 0; i < entries.length; i++) {
    var fileName = entries[i];
    var filePath = files.join(dir, fileName);
    try {
      var img = images.read(filePath);
      if (!img) continue;
      var w = img.getWidth();
      var h = img.getHeight();
      if (w > 0 && h > 0) {
        templates.push({ name: fileName, image: img, w: w, h: h });
      } else {
        img.recycle();
      }
    } catch (e) {
      console.warn("collect_feeding: error reading '" + filePath + "': " + e);
    }
  }
  return templates;
}

function _matchOne(screenImage, tpl, threshold) {
  if (!screenImage || !tpl || !tpl.image) return null;
  try {
    var searchRegion = [0, 0, screenImage.getWidth(), screenImage.getHeight()];
    var result = images.findImage(screenImage, tpl.image, {
      threshold: threshold || 0.7,
      region: searchRegion
    });
    if (result) {
      return {
        x: result.x,
        y: result.y,
        w: tpl.w,
        h: tpl.h,
        name: tpl.name,
        confidence: result.confidence !== undefined ? result.confidence : threshold
      };
    }
  } catch (e) {
    console.warn("collect_feeding: error matching \"" + tpl.name + "\": " + e);
  }
  return null;
}

function _tapAt(match, label, panel, config) {
  var tapX = match.x + Math.round(match.w / 2);
  var tapY = match.y + Math.round(match.h / 2);
  // Clamp Y to stay above the navigation bar so taps land on the app
  var navBarHeight = (config && config.ui && config.ui.navBarHeight) || Math.round(device.height * 0.07);
  var maxSafeY = device.height - navBarHeight;
  if (tapY > maxSafeY) {
    tapY = maxSafeY;
  }
  floatyMod.appendLog(panel, label + " at (" + tapX + "," + tapY + ")");
  floatyMod.withPanelHidden(panel, function() {
    press(tapX, tapY, 1000);
  });
}

// ---------------------------------------------------------------------------
// Find the first matching template on screen
// ---------------------------------------------------------------------------

function _findFirstMatch(screenImage, templates, threshold) {
  if (!templates || templates.length === 0) return null;
  for (var i = 0; i < templates.length; i++) {
    var match = _matchOne(screenImage, templates[i], threshold);
    if (match) return match;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

/**
 * Run the collect feeding flow.
 * Call AFTER advanture flow has completed and returned to main page.
 *
 * @param {Object} config - Configuration object (from config.js).
 * @param {Object} panel  - Floaty window for logging.
 */
function runCollectFeeding(config, panel) {
  var templateDir = (config && config.detection && config.detection.templateDir) || "./templates/";

  // ── Step 1: Load templates ──────────────────────────────────────────
  var feedingPageTemplates = _loadTemplatesFromDir(templateDir, "feeding");
  var collectTemplates = _loadTemplatesFromDir(templateDir, "feeding/collect");

  if (feedingPageTemplates.length === 0) {
    floatyMod.appendLog(panel, "No feeding page templates found — skipping collect feeding");
    return;
  }

  floatyMod.appendLog(panel, "Feeding templates: " + feedingPageTemplates.length +
    " page, " + collectTemplates.length + " collect items");

  // ── Step 2: Click feeding page entry button to open ─────────────────
  floatyMod.appendLog(panel, "Opening feeding page...");

  var opened = false;
  for (var attempt = 0; attempt < 5; attempt++) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(1000); continue; }

      var match = _findFirstMatch(img, feedingPageTemplates, 0.7);
      if (match) {
        _tapAt(match, "Tap " + match.name + " (open)", panel, config);
        opened = true;
        break;
      }
    } finally {
      if (img) img.recycle();
    }
    sleep(1000);
  }

  if (!opened) {
    floatyMod.appendLog(panel, "Could not find feeding page entry button — skipping");
    return;
  }

  // Wait for feeding page to fully open
  sleep(2000);

  // ── Step 3: Collect loop ────────────────────────────────────────────
  var collectThreshold = 0.7;
  var maxCollectIterations = 30;
  var collectedCount = 0;

  for (var iter = 0; iter < maxCollectIterations; iter++) {
    var screenImg = null;
    try {
      screenImg = captureScreen();
      if (!screenImg) { sleep(500); continue; }

      var collectMatch = _findFirstMatch(screenImg, collectTemplates, collectThreshold);
      if (collectMatch) {
        collectedCount++;
        _tapAt(collectMatch, "Collect " + collectMatch.name, panel, config);
        sleep(1500);
      } else {
        // No collect template found — done collecting
        if (collectedCount > 0) {
          floatyMod.appendLog(panel, "No more collect items found after " + collectedCount + " collected");
        } else {
          floatyMod.appendLog(panel, "No collect items found on feeding page");
        }
        break;
      }
    } finally {
      if (screenImg) screenImg.recycle();
    }
  }

  if (collectedCount >= maxCollectIterations) {
    floatyMod.appendLog(panel, "Collect loop reached max iterations (" + maxCollectIterations + ")");
  }

  // Wait a moment before closing
  sleep(1000);

  // ── Step 4: Double-click feeding page button to close ───────────────
  floatyMod.appendLog(panel, "Closing feeding page...");

  for (var clickNum = 0; clickNum < 2; clickNum++) {
    var found = false;
    for (var retry = 0; retry < 5; retry++) {
      var closeImg = null;
      try {
        closeImg = captureScreen();
        if (!closeImg) { sleep(500); continue; }

        var closeMatch = _findFirstMatch(closeImg, feedingPageTemplates, 0.7);
        if (closeMatch) {
          _tapAt(closeMatch, "Tap " + closeMatch.name + " (close #" + (clickNum + 1) + ")", panel, config);
          found = true;
          break;
        }
      } finally {
        if (closeImg) closeImg.recycle();
      }
      sleep(500);
    }

    if (!found) {
      floatyMod.appendLog(panel, "Could not find feeding page button for click #" + (clickNum + 1));
    }

    // Pause ~500ms between the two clicks (double-click behavior)
    if (clickNum === 0) {
      sleep(500);
    }
  }

  sleep(1000);
  floatyMod.appendLog(panel, "Collect feeding complete");
}

module.exports = { runCollectFeeding: runCollectFeeding };
