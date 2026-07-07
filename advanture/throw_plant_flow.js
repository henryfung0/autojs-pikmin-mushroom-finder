/**
 * advanture/throw_plant_flow.js — Throw Plant scanning flow
 *
 * Flow:
 *   1. Ensure on main page (isOnMainPage)
 *   2. Navigate to plant page — click "plant page clicker" templates repeatedly
 *      until "plant page checker" is visible on screen (DO NOT click it)
 *   3. On plant page — scan for throw items (templates/throw plant/throw/)
 *   4. If throw item found → click it → scroll down → click flow.jpg
 *   5. After flow.jpg → return to plant page via common dismiss buttons
 *   6. If no throw item found → scroll down a bit → check again
 *   7. After max empty loops → back to main page, standby
 *
 * Exports:
 *   runThrowPlantFlow(config, panel)  → void
 */

"auto";

var floatyMod = require("../ui/floaty");
var matcher   = require("../lib/matcher");
var advState  = require("./advanture_state");
var advConfig = require("../ui/config");

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

function _matchOne(screenImage, tpl, threshold, region) {
  if (!screenImage || !tpl || !tpl.image) return null;
  try {
    var searchRegion = region || [0, 0, screenImage.getWidth(), screenImage.getHeight()];
    var result = images.findImage(screenImage, tpl.image, {
      threshold: threshold || 0.8,
      region: searchRegion
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
  var navBarHeight = (advConfig.ui && advConfig.ui.navBarHeight) || Math.round(device.height * 0.07);
  var maxSafeY = device.height - navBarHeight;
  if (tapY > maxSafeY) {
    tapY = maxSafeY;
  }
  floatyMod.appendLog(panel, label + " at (" + tapX + "," + tapY + ")");
  floatyMod.withPanelHidden(panel, function() {
    _showTap(tapX, tapY);
    press(tapX, tapY, 1000);
  });
}

// ---------------------------------------------------------------------------
// Load throw plant templates
// ---------------------------------------------------------------------------

function loadThrowPlantTemplates(templateDir) {
  return {
    plantPageClicker: _loadTemplatesFromDir(templateDir, "throw plant/plant page clicker"),
    plantPageChecker: _loadTemplatesFromDir(templateDir, "throw plant/navigation"),
    throwItems:       _loadTemplatesFromDir(templateDir, "throw plant/throw"),
    flow:             _loadTemplatesFromDir(templateDir, "throw plant/navigation"),
    common:           _loadTemplatesFromDir(templateDir, "common"),
    mainNav:          _loadTemplatesFromDir(templateDir, "navigation")
  };
}

// ---------------------------------------------------------------------------
// Navigate to plant page — keep clicking plant page clicker until checker found
// Returns true once plant page checker is visible (DO NOT click checker).
// ---------------------------------------------------------------------------

function navigateToPlantPage(templates, panel) {
  var threshold = 0.7;
  var deadline = Date.now() + 60000;
  var clickerIdx = 0;

  while (!_shutdownRequested && Date.now() < deadline) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); continue; }

      // Step 1: Check if already on plant page (plant page checker visible)
      var onPlantPage = false;
      for (var i = 0; i < templates.plantPageChecker.length; i++) {
        var chkName = templates.plantPageChecker[i].name.toLowerCase();
        if (chkName.indexOf("plant page checker") !== -1) {
          var chk = _matchOne(img, templates.plantPageChecker[i], threshold);
          if (chk) {
            floatyMod.appendLog(panel, "On plant page (plant page checker found)");
            onPlantPage = true;
            break;
          }
        }
      }
      if (onPlantPage) {
        return true;
      }

      // Step 2: Not on plant page — click plant page clicker (round-robin)
      var clicked = false;
      var clickerTpl = templates.plantPageClicker[clickerIdx];
      if (!clickerTpl) {
        clickerIdx = 0;
        clickerTpl = templates.plantPageClicker[0];
      }

      if (clickerTpl) {
        var m = _matchOne(img, clickerTpl, threshold);
        if (m) {
          _tapAt(m, "Click plant page clicker: " + clickerTpl.name, panel);
          sleep(2000);
          clicked = true;
          clickerIdx = (clickerIdx + 1) % templates.plantPageClicker.length;
        }
      }

      if (!clicked) {
        // No clicker found — try common dismiss buttons to make progress
        floatyMod.appendLog(panel, "No plant page clicker found — trying common dismiss");
        for (var j = 0; j < templates.common.length; j++) {
          var cmnName = templates.common[j].name.toLowerCase();
          if (cmnName.indexOf("close") !== -1 || cmnName.indexOf("back") !== -1) continue;
          var cmn = _matchOne(img, templates.common[j], threshold);
          if (cmn) {
            _tapAt(cmn, "Common dismiss: " + templates.common[j].name, panel);
            sleep(1500);
            clicked = true;
            break;
          }
        }
        if (!clicked) {
          sleep(1000);
        }
      }
    } finally {
      if (img) img.recycle();
    }
  }

  floatyMod.appendLog(panel, "navigateToPlantPage: timeout");
  return false;
}

// ---------------------------------------------------------------------------
// Return to plant page — after flow.jpg clicked, use common dismiss until
// plant page checker re-appears.
// ---------------------------------------------------------------------------

function returnToPlantPage(templates, panel) {
  var threshold = 0.7;
  var deadline = Date.now() + 60000;

  while (!_shutdownRequested && Date.now() < deadline) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); continue; }

      // Check if plant page checker is visible again
      for (var i = 0; i < templates.plantPageChecker.length; i++) {
        var chkName = templates.plantPageChecker[i].name.toLowerCase();
        if (chkName.indexOf("plant page checker") !== -1) {
          var chk = _matchOne(img, templates.plantPageChecker[i], threshold);
          if (chk) {
            floatyMod.appendLog(panel, "Back on plant page");
            return true;
          }
        }
      }

      // Not back yet — click common dismiss (Pass 1: non-close/back first)
      var clicked = false;
      for (var j = 0; j < templates.common.length; j++) {
        var cmnName = templates.common[j].name.toLowerCase();
        if (cmnName.indexOf("close") !== -1 || cmnName.indexOf("back") !== -1) continue;
        var cmn = _matchOne(img, templates.common[j], threshold);
        if (cmn) {
          _tapAt(cmn, "Return to plant page: " + templates.common[j].name, panel);
          sleep(1500);
          clicked = true;
          break;
        }
      }

      // Pass 2: fallback to close/back
      if (!clicked) {
        for (var j = 0; j < templates.common.length; j++) {
          var cmnName = templates.common[j].name.toLowerCase();
          if (cmnName.indexOf("close") === -1 && cmnName.indexOf("back") === -1) continue;
          var cmn = _matchOne(img, templates.common[j], threshold);
          if (cmn) {
            _tapAt(cmn, "Return to plant page (dismiss): " + templates.common[j].name, panel);
            sleep(1500);
            clicked = true;
            break;
          }
        }
      }

      if (!clicked) {
        sleep(1000);
      }
    } finally {
      if (img) img.recycle();
    }
  }

  floatyMod.appendLog(panel, "returnToPlantPage: timeout");
  return false;
}

// ---------------------------------------------------------------------------
// Find throw item on screen (any template in throw/ folder)
// ---------------------------------------------------------------------------

function findThrowItem(screenImage, throwTemplates, config) {
  var threshold = (config && config.detection && config.detection.threshold) || 0.7;
  var navBarHeight = (advConfig.ui && advConfig.ui.navBarHeight) || Math.round(device.height * 0.07);
  var safeHeight = screenImage.getHeight() - navBarHeight;
  var safeRegion = [0, 0, screenImage.getWidth(), safeHeight];

  for (var i = 0; i < throwTemplates.length; i++) {
    var match = _matchOne(screenImage, throwTemplates[i], threshold, safeRegion);
    if (match) {
      match.name = throwTemplates[i].name;
      return match;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Click flow.jpg button
// ---------------------------------------------------------------------------

function clickFlowButton(templates, panel) {
  var threshold = 0.7;
  var img = null;
  for (var i = 0; i < templates.flow.length; i++) {
    var flowName = templates.flow[i].name.toLowerCase();
    if (flowName.indexOf("flow") !== -1) {
      img = captureScreen();
      if (!img) return false;
      var m = _matchOne(img, templates.flow[i], threshold);
      if (m) {
        _tapAt(m, "Click flow.jpg", panel);
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

/**
 * Run the throw plant scanning flow.
 *
 * @param {Object} config - Configuration object.
 * @param {Object} panel  - Floaty window for logging.
 */
function runThrowPlantFlow(config, panel) {
  var templateDir = (config && config.detection && config.detection.templateDir) || "./templates/";

  floatyMod.appendLog(panel, "Loading throw plant templates...");
  var templates = loadThrowPlantTemplates(templateDir);

  var mainNavTemplates = templates.mainNav.concat(templates.common);
  var commonTemplates = templates.common;

  floatyMod.appendLog(panel, "Templates — clicker:" + templates.plantPageClicker.length +
    " checker:" + templates.plantPageChecker.length +
    " throwItems:" + templates.throwItems.length +
    " flow:" + templates.flow.length +
    " common:" + commonTemplates.length);

  if (templates.throwItems.length === 0) {
    floatyMod.appendLog(panel, "Error: no throw item templates found");
    return;
  }

  var settleDelay = (config && config.scan && config.scan.settleDelay) || 2000;
  var maxEmptyLoops = 10;

  // Step 1: Ensure on main page
  floatyMod.appendLog(panel, "Ensuring on main page...");
  advState.isOnMainPage(mainNavTemplates, {
    threshold: 0.7,
    timeout: 30000,
    floaty: panel,
    dismissTemplates: commonTemplates
  });
  sleep(1000);

  // Step 2: Navigate to plant page
  floatyMod.appendLog(panel, "Navigating to plant page...");
  if (!navigateToPlantPage(templates, panel)) {
    floatyMod.appendLog(panel, "Could not reach plant page — exiting");
    return;
  }
  sleep(1000);

  // Step 3: Main loop — scan for throw items
  var loopCount = 0;
  var emptyLoopCount = 0;

  while (!_shutdownRequested) {
    loopCount++;

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
      var match = findThrowItem(screenImage, templates.throwItems, config);

      if (match) {
        emptyLoopCount = 0;
        floatyMod.updateStatus(panel, "THROW ITEM Found!");
        floatyMod.appendLog(panel, "Found throw item: " + match.name);

        // Click the throw item
        _tapAt(match, "Tap throw item: " + match.name, panel);
        sleep(2000);

        // Scroll down (2/3 scroll)
        floatyMod.appendLog(panel, "Scrolling to find flow.jpg...");
        var scrollDuration = (config && config.scan && config.scan.swipeDuration) || 600;
        swipe(
          Math.round(device.width * 0.5),
          Math.round(device.height * 0.8),
          Math.round(device.width * 0.5),
          Math.round(device.height * 0.47),
          scrollDuration
        );
        sleep(settleDelay);

        // Click flow.jpg
        floatyMod.appendLog(panel, "Looking for flow.jpg...");
        var flowClicked = clickFlowButton(templates, panel);
        if (flowClicked) {
          floatyMod.appendLog(panel, "flow.jpg clicked");
          sleep(2000);
        } else {
          // Scroll more if flow not found
          floatyMod.appendLog(panel, "flow.jpg not found — scrolling more...");
          swipe(
            Math.round(device.width * 0.5),
            Math.round(device.height * 0.8),
            Math.round(device.width * 0.5),
            Math.round(device.height * 0.47),
            scrollDuration
          );
          sleep(settleDelay);
          clickFlowButton(templates, panel);
          sleep(2000);
        }

        // Return to plant page via common dismiss buttons
        floatyMod.appendLog(panel, "Returning to plant page...");
        returnToPlantPage(templates, panel);
        sleep(1000);

      } else {
        // No throw item found — scroll down and check again
        floatyMod.appendLog(panel, "No throw item found — scrolling...");
        var scrollDuration = (config && config.scan && config.scan.swipeDuration) || 600;
        swipe(
          Math.round(device.width * 0.5),
          Math.round(device.height * 0.8),
          Math.round(device.width * 0.5),
          Math.round(device.height * 0.47),
          scrollDuration
        );
        sleep(settleDelay);

        emptyLoopCount++;
        floatyMod.appendLog(panel, "Empty loop #" + loopCount + " (emptyLoops=" + emptyLoopCount + ")");

        if (emptyLoopCount >= maxEmptyLoops) {
          floatyMod.appendLog(panel, "Max empty loops reached — back to main page, standby");
          advState.isOnMainPage(mainNavTemplates, {
            threshold: 0.7,
            timeout: 30000,
            floaty: panel,
            dismissTemplates: commonTemplates
          });
          break;
        }
      }
    } finally {
      screenImage.recycle();
    }

    sleep(500);
  }

  floatyMod.updateStatus(panel, "Stopped");
  floatyMod.appendLog(panel, "Throw plant flow stopped");
}

module.exports = {
  runThrowPlantFlow: runThrowPlantFlow
};
