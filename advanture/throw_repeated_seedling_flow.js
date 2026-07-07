/**
 * advanture/throw_repeated_seedling_flow.js — Throw Repeated Seedling scanning flow
 *
 * Flow:
 *   1. Ensure on main page (isOnMainPage)
 *   2. Navigate to seedling page — click "seedling page clicker" templates repeatedly
 *      until "seedling page checker" is visible on screen (DO NOT click it)
 *   3. On seedling page — scan for throw items (templates/throw_repeated_seedling/throw/)
 *   4. If throw item found → click it → scroll up to 10 times to find flow.jpg
 *      - If flow.jpg found → click it → click confirm.jpg → return to seedling page
 *      - If flow.jpg NOT found after 10 scrolls → back to seedling page, retry
 *   5. After flow.jpg + confirm.jpg → return to seedling page via common dismiss buttons
 *   6. If no throw item found → scroll down a bit → check again
 *   7. After max empty loops → back to main page, standby
 *
 * Exports:
 *   runThrowRepeatedSeedlingFlow(config, panel)  → void
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
// Load throw_repeated_seedling templates
// ---------------------------------------------------------------------------

function loadThrowRepeatedSeedlingTemplates(templateDir) {
  return {
    seedlingPageClicker: _loadTemplatesFromDir(templateDir, "throw_repeated_seedling/seedling page clicker"),
    seedlingPageChecker: _loadTemplatesFromDir(templateDir, "throw_repeated_seedling/navigation"),
    throwItems:       _loadTemplatesFromDir(templateDir, "throw_repeated_seedling/throw"),
    flow:             _loadTemplatesFromDir(templateDir, "throw_repeated_seedling/navigation"),
    confirm:           _loadTemplatesFromDir(templateDir, "throw_repeated_seedling/navigation"),
    common:           _loadTemplatesFromDir(templateDir, "common"),
    mainNav:          _loadTemplatesFromDir(templateDir, "navigation")
  };
}

// ---------------------------------------------------------------------------
// Navigate to seedling page — keep clicking seedling page clicker until checker found
// Returns true once seedling page checker is visible (DO NOT click checker).
// ---------------------------------------------------------------------------

function navigateToSeedlingPage(templates, panel) {
  var threshold = 0.7;
  var deadline = Date.now() + 60000;
  var clickerIdx = 0;
  var totalAttempts = 0;
  var maxAttempts = 30;

  while (!_shutdownRequested && Date.now() < deadline && totalAttempts < maxAttempts) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); continue; }

      // Step 1: Check if already on seedling page (seedling page checker visible)
      var onSeedlingPage = false;
      for (var i = 0; i < templates.seedlingPageChecker.length; i++) {
        var chkName = templates.seedlingPageChecker[i].name.toLowerCase();
        if (chkName.indexOf("seedling page checker") !== -1) {
          var chk = _matchOne(img, templates.seedlingPageChecker[i], threshold);
          if (chk) {
            floatyMod.appendLog(panel, "On seedling page (seedling page checker found)");
            onSeedlingPage = true;
            break;
          }
        }
      }
      if (onSeedlingPage) {
        return true;
      }

      // Step 2: Not on seedling page — click seedling page clicker (round-robin)
      var clicked = false;
      var clickerTpl = templates.seedlingPageClicker[clickerIdx];
      if (!clickerTpl) {
        clickerIdx = 0;
        clickerTpl = templates.seedlingPageClicker[0];
      }

      if (clickerTpl) {
        var m = _matchOne(img, clickerTpl, threshold);
        if (m) {
          _tapAt(m, "Click seedling page clicker: " + clickerTpl.name, panel);
          sleep(2000);
          clicked = true;
          clickerIdx = (clickerIdx + 1) % templates.seedlingPageClicker.length;
        }
      }

      if (!clicked) {
        // No clicker found — try common dismiss buttons to make progress
        floatyMod.appendLog(panel, "No seedling page clicker found — trying common dismiss");
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
          // Fallback: try close/back
          for (var j = 0; j < templates.common.length; j++) {
            var cmnName = templates.common[j].name.toLowerCase();
            if (cmnName.indexOf("close") === -1 && cmnName.indexOf("back") === -1) continue;
            var cmn = _matchOne(img, templates.common[j], threshold);
            if (cmn) {
              _tapAt(cmn, "Common dismiss (back): " + templates.common[j].name, panel);
              sleep(1500);
              clicked = true;
              break;
            }
          }
        }
        if (!clicked) {
          floatyMod.appendLog(panel, "Nothing found on screen — sleeping...");
          sleep(1000);
        }
      }

      totalAttempts++;
    } finally {
      if (img) img.recycle();
    }
  }

  floatyMod.appendLog(panel, "navigateToSeedlingPage: gave up after " + totalAttempts + " attempts");
  return false;
}

// ---------------------------------------------------------------------------
// Return to seedling page — after flow.jpg clicked, use common dismiss until
// seedling page checker re-appears.
// ---------------------------------------------------------------------------

function returnToSeedlingPage(templates, panel) {
  var threshold = 0.7;
  var deadline = Date.now() + 60000;

  while (!_shutdownRequested && Date.now() < deadline) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); continue; }

      // Check if seedling page checker is visible again
      for (var i = 0; i < templates.seedlingPageChecker.length; i++) {
        var chkName = templates.seedlingPageChecker[i].name.toLowerCase();
        if (chkName.indexOf("seedling page checker") !== -1) {
          var chk = _matchOne(img, templates.seedlingPageChecker[i], threshold);
          if (chk) {
            floatyMod.appendLog(panel, "Back on seedling page");
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
          _tapAt(cmn, "Return to seedling page: " + templates.common[j].name, panel);
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
            _tapAt(cmn, "Return to seedling page (dismiss): " + templates.common[j].name, panel);
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

  floatyMod.appendLog(panel, "returnToSeedlingPage: timeout");
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
// Click confirm.jpg button
// ---------------------------------------------------------------------------

function clickConfirmButton(templates, panel) {
  var threshold = 0.7;
  var img = null;
  for (var i = 0; i < templates.confirm.length; i++) {
    var confirmName = templates.confirm[i].name.toLowerCase();
    if (confirmName.indexOf("confirm") !== -1) {
      img = captureScreen();
      if (!img) return false;
      var m = _matchOne(img, templates.confirm[i], threshold);
      if (m) {
        _tapAt(m, "Click confirm.jpg", panel);
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
 * Run the throw_repeated_seedling scanning flow.
 *
 * @param {Object} config - Configuration object.
 * @param {Object} panel  - Floaty window for logging.
 */
function runThrowRepeatedSeedlingFlow(config, panel) {
  var templateDir = (config && config.detection && config.detection.templateDir) || "./templates/";

  floatyMod.appendLog(panel, "Loading throw_repeated_seedling templates...");
  var templates = loadThrowRepeatedSeedlingTemplates(templateDir);

  var mainNavTemplates = templates.mainNav.concat(templates.common);
  var commonTemplates = templates.common;

  floatyMod.appendLog(panel, "Templates — clicker:" + templates.seedlingPageClicker.length +
    " checker:" + templates.seedlingPageChecker.length +
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

  // Step 2: Navigate to seedling page
  floatyMod.appendLog(panel, "Navigating to seedling page...");
  if (!navigateToSeedlingPage(templates, panel)) {
    floatyMod.appendLog(panel, "Could not reach seedling page — exiting");
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

        // Scroll and look for flow.jpg — up to 10 times
        var scrollDuration = (config && config.scan && config.scan.swipeDuration) || 600;
        var flowFound = false;
        var scrollCount = 0;
        var maxScrolls = 10;

        while (scrollCount < maxScrolls && !flowFound && !_shutdownRequested) {
          floatyMod.appendLog(panel, "Scrolling to find flow.jpg (" + (scrollCount + 1) + "/" + maxScrolls + ")...");
          swipe(
            Math.round(device.width * 0.5),
            Math.round(device.height * 0.8),
            Math.round(device.width * 0.5),
            Math.round(device.height * 0.47),
            scrollDuration
          );
          sleep(settleDelay);

          flowFound = clickFlowButton(templates, panel);
          scrollCount++;
        }

        if (!flowFound) {
          // Could not find flow.jpg after max scrolls — go back to seedling page
          floatyMod.appendLog(panel, "flow.jpg not found after " + maxScrolls + " scrolls — back to seedling page");
          returnToSeedlingPage(templates, panel);
          sleep(1000);
          continue;
        }

        // flow.jpg found — click it
        floatyMod.appendLog(panel, "flow.jpg clicked");
        sleep(2000);

        // Click confirm.jpg
        floatyMod.appendLog(panel, "Looking for confirm.jpg...");
        var confirmClicked = clickConfirmButton(templates, panel);
        if (confirmClicked) {
          floatyMod.appendLog(panel, "confirm.jpg clicked");
          sleep(2000);
        }

        // Return to seedling page via common dismiss buttons
        floatyMod.appendLog(panel, "Returning to seedling page...");
        returnToSeedlingPage(templates, panel);
        sleep(1000);

        // Verify we are actually back on seedling page
        floatyMod.appendLog(panel, "Verifying seedling page...");
        var backVerified = false;
        var backAttempts = 0;
        while (backAttempts < 10 && !backVerified && !_shutdownRequested) {
          var verifyImg = captureScreen();
          if (!verifyImg) { sleep(500); backAttempts++; continue; }
          try {
            for (var vi = 0; vi < templates.seedlingPageChecker.length; vi++) {
              var vcName = templates.seedlingPageChecker[vi].name.toLowerCase();
              if (vcName.indexOf("seedling page checker") !== -1) {
                var vchk = _matchOne(verifyImg, templates.seedlingPageChecker[vi], 0.7);
                if (vchk) {
                  backVerified = true;
                  floatyMod.appendLog(panel, "Seedling page verified");
                  break;
                }
              }
            }
            if (!backVerified) {
              floatyMod.appendLog(panel, "Not on seedling page — tapping common...");
              // Try non-close/back first
              var tapped = false;
              for (var tj = 0; tj < templates.common.length && !tapped; tj++) {
                var tn = templates.common[tj].name.toLowerCase();
                if (tn.indexOf("close") !== -1 || tn.indexOf("back") !== -1) continue;
                var tm = _matchOne(verifyImg, templates.common[tj], 0.7);
                if (tm) {
                  _tapAt(tm, "Verify tap common: " + templates.common[tj].name, panel);
                  sleep(1500);
                  tapped = true;
                }
              }
              // Fallback close/back
              if (!tapped) {
                for (var tj = 0; tj < templates.common.length && !tapped; tj++) {
                  var tn = templates.common[tj].name.toLowerCase();
                  if (tn.indexOf("close") === -1 && tn.indexOf("back") === -1) continue;
                  var tm = _matchOne(verifyImg, templates.common[tj], 0.7);
                  if (tm) {
                    _tapAt(tm, "Verify tap dismiss: " + templates.common[tj].name, panel);
                    sleep(1500);
                    tapped = true;
                  }
                }
              }
              if (!tapped) sleep(1000);
              backAttempts++;
            }
          } finally {
            verifyImg.recycle();
          }
        }

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
  floatyMod.appendLog(panel, "Throw repeated seedling flow stopped");
}

module.exports = {
  runThrowRepeatedSeedlingFlow: runThrowRepeatedSeedlingFlow
};
