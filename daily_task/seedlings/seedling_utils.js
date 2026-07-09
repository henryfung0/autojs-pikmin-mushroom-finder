"auto";

/**
 * advanture/seedling_utils.js — Shared utilities for seedling operations
 *
 * Shared functions extracted from seedlings_flow.js.
 * Used by collect_seedlings.js, farm_seedlings.js, and throw_repeated_seedling_flow.js.
 */

var floatyMod  = require("../../ui/floaty");
var advConfig  = require("../../ui/config");

// ---------------------------------------------------------------------------
// Volume Key Handler (idempotent)
//
// Single volume press  → graceful stop (sets _shutdownRequested).
// Double volume press  → force stop (engines.myEngine().stop()).
//
// Uses _volumeKeySetup guard so setupVolumeKeyHandler() can be called
// multiple times from different modules without re-registering the listener.
// ---------------------------------------------------------------------------

var _shutdownRequested = false;
var _lastKeyTime = 0;
var _doublePressTimeout = 500;

var _volumeKeySetup = false;

function setupVolumeKeyHandler() {
  if (_volumeKeySetup) return;
  _volumeKeySetup = true;
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
}

function isShutdownRequested() {
  return _shutdownRequested;
}

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

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

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
// Load seedlings templates
// ---------------------------------------------------------------------------

function loadThrowRepeatedSeedlingTemplates(templateDir) {
  return {
    seedlingPageClicker: _loadTemplatesFromDir(templateDir, "seedlings/seedling page clicker"),
    seedlingPageChecker: _loadTemplatesFromDir(templateDir, "seedlings/navigation"),
    throwItems:       _loadTemplatesFromDir(templateDir, "seedlings/throw"),
    flow:             _loadTemplatesFromDir(templateDir, "seedlings/navigation"),
    confirm:           _loadTemplatesFromDir(templateDir, "seedlings/navigation"),
    collect:          _loadTemplatesFromDir(templateDir, "seedlings/collect"),
    common:           _loadTemplatesFromDir(templateDir, "common"),
    mainNav:          _loadTemplatesFromDir(templateDir, "navigation")
  };
}

// ---------------------------------------------------------------------------
// Seedling page navigation
// ---------------------------------------------------------------------------

function isOnSeedlingPage1(templates, panel) {
  var threshold = 0.7;
  var img = null;
  try {
    img = captureScreen();
    if (!img) return false;
    for (var i = 0; i < templates.seedlingPageChecker.length; i++) {
      var name = templates.seedlingPageChecker[i].name.toLowerCase();
      if (name.indexOf("to seedling page") !== -1) {
        var m = _matchOne(img, templates.seedlingPageChecker[i], threshold);
        if (m) return true;
      }
    }
  } finally {
    if (img) img.recycle();
  }
  return false;
}

function ensureOnSeedlingPage1(templates, panel) {
  var threshold = 0.7;
  var deadline = Date.now() + 60000;  // 60 second total timeout
  var maxNavAttempts = 10;

  for (var navAttempt = 0; navAttempt < maxNavAttempts && !_shutdownRequested && Date.now() < deadline; navAttempt++) {
    if (isOnSeedlingPage1(templates, panel)) {
      return true;
    }

    floatyMod.appendLog(panel, "ensureOnSeedlingPage1: not on seedling page 1 (attempt " + (navAttempt + 1) + "/" + maxNavAttempts + ")");

    // Try to progress using common dismiss buttons first
    var progressMade = false;
    var img = captureScreen();
    if (img) {
      try {
        // Try non-close/back common buttons first
        for (var i = 0; i < templates.common.length && !progressMade; i++) {
          var cn = templates.common[i].name.toLowerCase();
          if (cn.indexOf("close") !== -1 || cn.indexOf("back") !== -1) continue;
          var m = _matchOne(img, templates.common[i], threshold);
          if (m) {
            _tapAt(m, "ensureOnSeedlingPage1: common dismiss: " + templates.common[i].name, panel);
            progressMade = true;
            sleep(1500);
          }
        }
        // Fallback to close/back
        if (!progressMade) {
          for (var i = 0; i < templates.common.length && !progressMade; i++) {
            var cn = templates.common[i].name.toLowerCase();
            if (cn.indexOf("close") === -1 && cn.indexOf("back") === -1) continue;
            var m = _matchOne(img, templates.common[i], threshold);
            if (m) {
              _tapAt(m, "ensureOnSeedlingPage1: common dismiss: " + templates.common[i].name, panel);
              progressMade = true;
              sleep(1500);
            }
          }
        }
      } finally {
        img.recycle();
      }
    }

    if (!isOnSeedlingPage1(templates, panel)) {
      // Try clicking "seedling page.jpg" to enter
      img = captureScreen();
      if (img) {
        try {
          for (var i = 0; i < templates.seedlingPageClicker.length; i++) {
            var m = _matchOne(img, templates.seedlingPageClicker[i], threshold);
            if (m) {
              _tapAt(m, "ensureOnSeedlingPage1: click: " + templates.seedlingPageClicker[i].name, panel);
              sleep(2000);
              break;
            }
          }
        } finally {
          img.recycle();
        }
      }
    }

    sleep(1500);
  }

  // Final check
  if (isOnSeedlingPage1(templates, panel)) {
    return true;
  }

  floatyMod.appendLog(panel, "ensureOnSeedlingPage1: gave up after timeout");
  return false;
}

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
// Navigate from Seedling Page 1 → Seedling Page 2
// Clicks "to seedling page.jpg" (visible on page 1) to advance to page 2.
// Verifies with "seedling page checker" template (page 2 specific).
// ---------------------------------------------------------------------------

function ensureOnSeedlingPage2(templates, panel) {
  var threshold = 0.7;
  var maxAttempts = 5;

  for (var attempt = 0; attempt < maxAttempts && !_shutdownRequested; attempt++) {
    // First check if already on page 2 (seedling page checker visible)
    var img = captureScreen();
    if (img) {
      try {
        for (var ci = 0; ci < templates.seedlingPageChecker.length; ci++) {
          var cn = templates.seedlingPageChecker[ci].name.toLowerCase();
          if (cn.indexOf("seedling page checker") !== -1) {
            var ck = _matchOne(img, templates.seedlingPageChecker[ci], threshold);
            if (ck) {
              floatyMod.appendLog(panel, "Already on seedling page 2");
              return true;
            }
          }
        }
      } finally {
        img.recycle();
      }
    }

    // Not on page 2 — find and click "to seedling page.jpg" from page 1
    img = captureScreen();
    if (img) {
      try {
        for (var ti = 0; ti < templates.seedlingPageChecker.length; ti++) {
          var tn = templates.seedlingPageChecker[ti].name.toLowerCase();
          if (tn.indexOf("to seedling page") !== -1) {
            var tm = _matchOne(img, templates.seedlingPageChecker[ti], threshold);
            if (tm) {
              _tapAt(tm, "ensureOnSeedlingPage2: click " + templates.seedlingPageChecker[ti].name, panel);
              sleep(2000);
              // Check if we've arrived on page 2
              var verifyImg = captureScreen();
              if (verifyImg) {
                try {
                  for (var vi = 0; vi < templates.seedlingPageChecker.length; vi++) {
                    var vn = templates.seedlingPageChecker[vi].name.toLowerCase();
                    if (vn.indexOf("seedling page checker") !== -1) {
                      var vc = _matchOne(verifyImg, templates.seedlingPageChecker[vi], threshold);
                      if (vc) {
                        floatyMod.appendLog(panel, "On seedling page 2");
                        return true;
                      }
                    }
                  }
                } finally {
                  verifyImg.recycle();
                }
              }
              // Not on page 2 yet — wait more
              sleep(1500);
              break;
            }
          }
        }
      } finally {
        if (img) img.recycle();
      }
    }

    if (attempt < maxAttempts - 1) {
      sleep(1500);
    }
  }

  floatyMod.appendLog(panel, "ensureOnSeedlingPage2: could not reach seedling page 2");
  return false;
}

module.exports = {
  setupVolumeKeyHandler: setupVolumeKeyHandler,
  isShutdownRequested: isShutdownRequested,
  _matchOne: _matchOne,
  _loadTemplatesFromDir: _loadTemplatesFromDir,
  _tapAt: _tapAt,
  loadThrowRepeatedSeedlingTemplates: loadThrowRepeatedSeedlingTemplates,
  isOnSeedlingPage1: isOnSeedlingPage1,
  ensureOnSeedlingPage1: ensureOnSeedlingPage1,
  ensureOnSeedlingPage2: ensureOnSeedlingPage2,
  returnToSeedlingPage: returnToSeedlingPage
};
