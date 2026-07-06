/**
 * advanture/advanture_flow.js — Adventure scanning flow
 *
 * Main adventure automation loop:
 *   1. Load templates from templates/advanture/{navigation,fruit,gift,plant}/
 *   2. Check isOnMainPage → click Advanture.jpg to enter adventure
 *   3. Check isOnAdvanturePage → scroll down to reveal items
 *   4. Scan for fruit/gift/plant with priority: gift > plant > fruit
 *   5. Click matched item → Start advanture → Auto → wait for Go
 *   6. Check on adventure page → repeat from step 3
 *
 * Exports:
 *   runAdvantureFlow(config, panel)  → void
 */

"auto";

var floatyMod = require("../ui/floaty");
var scroll = require("../lib/gestures");
var matcher = require("../lib/matcher");
var advState = require("./advanture_state");

// ---------------------------------------------------------------------------
// Volume key interrupt
//
// Single volume press  → graceful stop (sets _shutdownRequested).
// Double volume press  → force stop (engines.myEngine().stop()).
// ---------------------------------------------------------------------------

var _shutdownRequested = false;
var _lastKeyTime = 0;
var _doublePressTimeout = 500;

events.observeKey();

events.onKeyDown("volume_up", function(event) {
  var now = new Date().getTime();
  if (now - _lastKeyTime < _doublePressTimeout) {
    _shutdownRequested = true;
    engines.myEngine().stop();
  } else {
    _shutdownRequested = true;
  }
  _lastKeyTime = now;
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

var _clickDot = null;

function _showTap(x, y) {
  if (!_clickDot) {
    _clickDot = floaty.rawWindow(
      <frame bg="#FF4444" w="18dp" h="18dp" />
    );
    _clickDot.setTouchable(false);
  }
  var halfPx = Math.round(9 * device.density);
  var sbH = device.statusBarHeight || 0;
  _clickDot.setPosition(x - halfPx, y - halfPx - sbH);
  if (_clickDot._hideTimer) clearTimeout(_clickDot._hideTimer);
  _clickDot._hideTimer = setTimeout(function() {
    _clickDot.setPosition(-999, -999);
  }, 800);
}

function _matchOne(screenImage, tpl, threshold) {
  if (!screenImage || !tpl || !tpl.image) return null;
  try {
    var result = images.findImage(screenImage, tpl.image, {
      threshold: threshold || 0.8,
      region: [0, 0, screenImage.getWidth(), screenImage.getHeight()]
    });
    if (result) {
      var confidence = result.confidence !== undefined ? result.confidence : threshold;
      return {
        x: result.x,
        y: result.y,
        w: tpl.w,
        h: tpl.h,
        name: tpl.name,
        confidence: confidence
      };
    }
  } catch (e) {
    console.warn("_matchOne: error matching \"" + tpl.name + "\": " + e);
  }
  return null;
}

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
    console.warn("_loadTemplatesFromDir: cannot list '" + dir + "': " + e);
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
      console.warn("_loadTemplatesFromDir: error reading '" + filePath + "': " + e);
    }
  }
  return templates;
}

// ---------------------------------------------------------------------------
// Tap helpers
// ---------------------------------------------------------------------------

function _tapAt(match, label, panel) {
  var tapX = match.x + Math.round(match.w / 2);
  var tapY = match.y + Math.round(match.h / 2);
  floatyMod.appendLog(panel, label + " at (" + tapX + "," + tapY + ")");
  floatyMod.withPanelHidden(panel, function() {
    _showTap(tapX, tapY);
    press(tapX, tapY, 1000);
  });
}

// ---------------------------------------------------------------------------
// Load all adventure templates
// ---------------------------------------------------------------------------

function loadAdventureTemplates(templateDir) {
  return {
    nav:      _loadTemplatesFromDir(templateDir, "advanture/navigation"),
    fruit:    _loadTemplatesFromDir(templateDir, "advanture/fruit"),
    gift:     _loadTemplatesFromDir(templateDir, "advanture/gift"),
    plant:    _loadTemplatesFromDir(templateDir, "advanture/plant"),
    fullPlant:_loadTemplatesFromDir(templateDir, "advanture/full plant")
  };
}

// ---------------------------------------------------------------------------
// Find best item (gift > plant > fruit) on screen
// ---------------------------------------------------------------------------

function findBestItem(screenImage, templates, config, skipPlant) {
  var threshold = (config && config.detection && config.detection.threshold) || 0.7;

  // Priority order: gift, plant, fruit
  // Only check categories enabled in config
  var categories = [];
  if (config && config.advanture && config.advanture.enableGift !== false) {
    categories.push({ key: "gift",  templates: templates.gift });
  }
  if (config && config.advanture && config.advanture.enablePlant !== false && !skipPlant) {
    categories.push({ key: "plant", templates: templates.plant });
  }
  if (config && config.advanture && config.advanture.enableFruit !== false) {
    categories.push({ key: "fruit", templates: templates.fruit });
  }

  for (var c = 0; c < categories.length; c++) {
    var cat = categories[c];
    if (!cat.templates || cat.templates.length === 0) continue;
    for (var i = 0; i < cat.templates.length; i++) {
      var tpl = cat.templates[i];
      var match = _matchOne(screenImage, tpl, threshold);
      if (match) {
        match.category = cat.key;
        return match;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Start an adventure item (tap item, then Start Advanture, then Auto)
// ---------------------------------------------------------------------------

function startAdventureItem(match, navTemplates, panel, fullPlantTemplates, dismissTemplates) {
  // Tap the matched item
  _tapAt(match, "Tap " + match.category + " item", panel);
  sleep(2000);

  // ── If plant, check if it's full ──────────────────────────────
  if (match.category === "plant" && fullPlantTemplates && fullPlantTemplates.length > 0) {
    var checkImg = null;
    try {
      checkImg = captureScreen();
      if (checkImg) {
        for (var i = 0; i < fullPlantTemplates.length; i++) {
          var fpMatch = _matchOne(checkImg, fullPlantTemplates[i], 0.7);
          if (fpMatch) {
            floatyMod.appendLog(panel, "Plant is full — detected " + fullPlantTemplates[i].name);
            floatyMod.appendLog(panel, "Will skip plants in future loops");

            // Try to click Cancel / Cancel2 from common templates to dismiss popup
            if (dismissTemplates && dismissTemplates.length > 0) {
              for (var d = 0; d < dismissTemplates.length; d++) {
                var dName = dismissTemplates[d].name.toLowerCase();
                if (dName.indexOf("cancel") !== -1) {
                  var cancelMatch = _matchOne(checkImg, dismissTemplates[d], 0.7);
                  if (cancelMatch) {
                    _tapAt(cancelMatch, "Tap " + dismissTemplates[d].name + " (full plant dismiss)", panel);
                    sleep(2000);
                    break;
                  }
                }
              }
            }
            return "full";
          }
        }
      }
    } finally {
      if (checkImg) checkImg.recycle();
    }
  }

  // Look for "Start advanture" button
  var img = null;
  var startTpl = null;
  for (var i = 0; i < navTemplates.length; i++) {
    if (navTemplates[i].name.toLowerCase().indexOf("start advanture") !== -1) {
      startTpl = navTemplates[i];
      break;
    }
  }

  if (!startTpl) {
    floatyMod.appendLog(panel, "Start advanture template not found");
    return false;
  }

  var found = false;
  var attempts = 0;
  while (attempts < 10 && !found && !_shutdownRequested) {
    img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); attempts++; continue; }
      var m = _matchOne(img, startTpl, 0.7);
      if (m) {
        _tapAt(m, "Tap Start Advanture", panel);
        found = true;
      } else {
        sleep(500);
        attempts++;
      }
    } finally {
      if (img) img.recycle();
    }
  }

  if (!found) return false;
  sleep(1500);

  // Tap "Auto"
  var autoTpl = null;
  for (var i = 0; i < navTemplates.length; i++) {
    if (navTemplates[i].name.toLowerCase().indexOf("auto") !== -1) {
      autoTpl = navTemplates[i];
      break;
    }
  }

  if (autoTpl) {
    var autoFound = false;
    attempts = 0;
    while (attempts < 10 && !autoFound && !_shutdownRequested) {
      img = null;
      try {
        img = captureScreen();
        if (!img) { sleep(500); attempts++; continue; }
        var m = _matchOne(img, autoTpl, 0.7);
        if (m) {
          _tapAt(m, "Tap Auto", panel);
          autoFound = true;
        } else {
          sleep(500);
          attempts++;
        }
      } finally {
        if (img) img.recycle();
      }
    }
    sleep(1500);
  }

  // Wait for "Go"
  var goTpl = null;
  for (var i = 0; i < navTemplates.length; i++) {
    if (navTemplates[i].name.toLowerCase().indexOf("go") !== -1) {
      goTpl = navTemplates[i];
      break;
    }
  }

  if (goTpl) {
    var goFound = false;
    attempts = 0;
    while (attempts < 20 && !goFound && !_shutdownRequested) {
      img = null;
      try {
        img = captureScreen();
        if (!img) { sleep(500); attempts++; continue; }
        var m = _matchOne(img, goTpl, 0.7);
        if (m) {
          _tapAt(m, "Tap Go", panel);
          goFound = true;
        } else {
          sleep(500);
          attempts++;
        }
      } finally {
        if (img) img.recycle();
      }
    }
    floatyMod.appendLog(panel, "Adventure started" + (goFound ? "" : " (Go not found, continuing)"));
  }

  return true;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

/**
 * Run the adventure scanning flow.
 *
 * @param {Object} config - Configuration object (from config.js).
 * @param {Object} panel  - Floaty window for logging.
 */
function runAdvantureFlow(config, panel) {
  var templateDir = (config && config.detection && config.detection.templateDir) || "./templates/";

  floatyMod.appendLog(panel, "Loading adventure templates...");
  var templates = loadAdventureTemplates(templateDir);

  // Also load main navigation + common templates for state detection
  var mainNavTemplates = _loadTemplatesFromDir(templateDir, "navigation");  // templates/navigation/ (has store detector.jpg, Advanture detector)
  var commonTemplates = _loadTemplatesFromDir(templateDir, "common");       // templates/common/ (has dismiss buttons)
  var mainTemplates = mainNavTemplates.concat(commonTemplates);             // combined for state checks

  // Load advanture entry buttons from subfolder (Advanture.jpg, Collect.jpg, Mushroom.jpg)
  var advEntryTemplates = _loadTemplatesFromDir(templateDir, "navigation/to_advanture");

  floatyMod.appendLog(panel, "Templates — nav:" + templates.nav.length +
    " fruit:" + templates.fruit.length +
    " gift:" + templates.gift.length +
    " plant:" + templates.plant.length +
    " fullPlant:" + templates.fullPlant.length);

  if (templates.nav.length === 0) {
    floatyMod.appendLog(panel, "Error: no navigation templates found");
    return;
  }

  var settleDelay = (config && config.scan && config.scan.settleDelay) || 2000;

  floatyMod.appendLog(panel, "Starting adventure scan loop");

  var loopCount = 0;
  var emptyLoopCount = 0;
  var plantFull = false;
  var maxEmptyLoops = (config && config.advanture && config.advanture.maxEmptyLoops) || 10;

  while (!_shutdownRequested) {
    loopCount++;

    // ── Step 1: Ensure we're on advanture page ────────────────────────
    // isOnAdvanturePage checks for advanture detector first.
    // If not found, it navigates to main page → clicks Advanture.jpg → re-checks.
    // If true, we're on advanture page. If false, we couldn't get there.
    if (!advState.isOnAdvanturePage(mainTemplates, templates.nav, { floaty: panel, threshold: 0.7, dismissTemplates: commonTemplates, entryTemplates: advEntryTemplates })) {
      floatyMod.appendLog(panel, "Could not reach advanture page — retrying...");
      sleep(2000);
      continue;
    }

    // ── Step 2: Capture and scan for items (no scroll first) ───────────
    var img = null;
    var screenImage = null;
    var captureAttempts = 0;
    while (captureAttempts < 3 && !screenImage) {
      captureAttempts++;
      try {
        screenImage = captureScreen();
      } catch (e) {
        screenImage = null;
      }
      if (!screenImage && captureAttempts < 3) {
        try {
          images.requestScreenCapture(false);
        } catch (e) { }
        sleep(2000);
      }
    }

    if (!screenImage) {
      floatyMod.appendLog(panel, "Capture failed, retrying...");
      sleep(1000);
      continue;
    }

    try {
      var match = findBestItem(screenImage, templates, config, plantFull);
      if (match) {
        emptyLoopCount = 0;
        floatyMod.updateStatus(panel, match.category.toUpperCase() + " Found!");
        floatyMod.appendLog(panel, "Found " + match.category + " — starting adventure...");
        var result = startAdventureItem(match, templates.nav, panel, templates.fullPlant, commonTemplates);
        if (result === "full") {
          plantFull = true;
          floatyMod.appendLog(panel, "Plant is full — will skip plants from now on");
        } else if (result === true) {
          floatyMod.appendLog(panel, "Adventure launched for " + match.category);
        }
        sleep(3000);

        // Wait to be back on adventure page
        var backAttempts = 0;
        while (backAttempts < 15 && !_shutdownRequested) {
          if (advState.isOnAdvanturePage(mainTemplates, templates.nav, { floaty: panel, threshold: 0.7, dismissTemplates: commonTemplates, entryTemplates: advEntryTemplates })) {
            floatyMod.appendLog(panel, "Back on adventure page");
            break;
          }
          sleep(1000);
          backAttempts++;
        }
      } else {
        // Scroll to reveal more items
        floatyMod.appendLog(panel, "No item found — scrolling...");
        var scrollDuration = (config && config.scan && config.scan.swipeDuration) || 1200;
        swipe(
          Math.round(device.width * 0.5),
          Math.round(device.height * 0.8),
          Math.round(device.width * 0.5),
          Math.round(device.height * 0.3),
          scrollDuration
        );
        sleep(settleDelay);

        if (_shutdownRequested) break;

        emptyLoopCount++;
        floatyMod.appendLog(panel, "No item found on this scroll (#" + loopCount + ", emptyLoops=" + emptyLoopCount + ")");
        if (emptyLoopCount >= maxEmptyLoops) {
          floatyMod.appendLog(panel, "Reached " + maxEmptyLoops + " empty loops — returning to main page");
          break;
        }
      }
    } finally {
      screenImage.recycle();
    }

    sleep(500);
  }

  floatyMod.updateStatus(panel, "Stopped");
  floatyMod.appendLog(panel, "Adventure scan stopped");
}

module.exports = {
  runAdvantureFlow: runAdvantureFlow
};
