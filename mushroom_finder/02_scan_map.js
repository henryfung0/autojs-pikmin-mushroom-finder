/**
 * mushroom_finder/02_scan_map.js — Scan loop (Phase 2)
 *
 * Orchestrates the full scan cycle: capture screen, run detection,
 * compile results, and fire callbacks when mushrooms with free
 * slots are found.
 *
 * Scan pattern: always scroll left at a fixed Y, forever.
 *
 * Module-level exports:
 *   startScanning(config, templates, onFound, floatyW)
 *   stopScanning()
 *   isScanning()
 */

"auto";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

var detection = require("../lib/matcher");
var floatyMod = require("../ui/floaty");
var scroll = require("../lib/gestures");
var navigator = require("./01_navigate_to_map");

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

var _shutdownRequested = false;
var _userStopped = false;
var _totalSwipes = 0;
var _emptyScrollCount = 0;
var _scanning = false;
var _lastKeyTime = 0;
var _doublePressTimeout = 500;
var _scrollDirection = -1; // -1 = left, 1 = right

// ---------------------------------------------------------------------------
// Volume key interrupt
//
// CRITICAL: events.observeKey() MUST be called BEFORE onKeyDown().
// Single volume press  → graceful stop (sets _shutdownRequested).
// Double volume press  → force stop (engines.myEngine().stop()).
// ---------------------------------------------------------------------------

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
// Public API
// ---------------------------------------------------------------------------

/**
 * Start scanning the game map for mushrooms.
 * Y is fixed — no row shifting. Swipes keep firing at the same Y
 * coordinate until a mushroom is found or the user stops the scan.
 *
 * @param {Object}   config    - Configuration object (from config.js).
 * @param {Object[]} templates - Template descriptors from loadAllTemplates().
 * @param {Function} onFound   - Callback invoked with the first match object
 *     when a mushroom is detected.
 * @param {Object}   floatyW   - Floaty window instance from createFloaty().
 */
function startScanning(config, templates, onFound, floatyW, extraOptions) {
  if (!templates || templates.length === 0) {
    console.error("startScanning: templates array is empty, cannot scan");
    floatyMod.updateStatus(floatyW, "Error: No templates");
    return;
  }

  _shutdownRequested = false;
  _userStopped = false;
  _totalSwipes = 0;
  _emptyScrollCount = 0;
  _scanning = true;

  var othersTemplates = (extraOptions && extraOptions.othersTemplates) || [];
  var navTemplates = (extraOptions && extraOptions.navTemplates) || [];
  var maxEmptyScrolls = (extraOptions && extraOptions.maxEmptyScrolls) || config.scan.maxEmptyScrolls || 5;

  floatyMod.appendLog(floatyW, "Scan engine started");
  console.info("startScanning: entered scan loop");

  try {
    images.requestScreenCapture(false);
  } catch (e) {
    // Non-fatal
  }

  floatyMod.showDuringScan(floatyW, true);
  floatyMod.updateStatus(floatyW, "Searching...");

  // Pinch-to-zoom-out first so the map shows more area per swipe
  floatyMod.appendLog(floatyW, "Zooming out...");
  scroll.zoomOut(3, floatyW);
  sleep(2000);

  var settleDelay = config.scan.settleDelay;
  var swipeDuration = config.scan.swipeDuration;
  if (swipeDuration > 2000) {
    swipeDuration = 2000;
  }
  if (settleDelay < 1500) {
    floatyMod.appendLog(floatyW, "Note: settleDelay was " + settleDelay + "ms, raising to 1500ms");
    settleDelay = 1500;
  }

  // Fixed Y for all swipes — 42% of screen height (approx 1008 on 2400px screen)
  var currentY = Math.round(device.height * 0.42);

  console.info("DEBUG: device.width=" + device.width + ", device.height=" + device.height);
  console.info("DEBUG: currentY=" + currentY + ", settleDelay=" + settleDelay);

  // ── Main scan loop — swipe left at fixed Y, forever ─────────────────
  while (!_shutdownRequested && _scanning) {
    _totalSwipes++;

    console.info("DEBUG SWIPE: swipeNum=" + _totalSwipes + ", currentY=" + currentY +
      ", startX=" + Math.round(device.width * 0.2) +
      ", endX=" + Math.round(device.width * 0.8));

    if (_scrollDirection === -1) {
      scroll.scrollLeft(currentY, swipeDuration, floatyW,
        "Swipe " + _totalSwipes + " ←");
    } else {
      scroll.scrollRight(currentY, swipeDuration, floatyW,
        "Swipe " + _totalSwipes + " →");
    }

    sleep(settleDelay);

    if (_shutdownRequested) {
      break;
    }

    // ── Capture → detect cycle ───────────────────────────────────────
    var screenImage = null;
    var captureAttempts = 0;
    var maxCaptureAttempts = 3;

    while (captureAttempts < maxCaptureAttempts && !screenImage) {
      captureAttempts++;
      try {
        screenImage = captureScreen();
      } catch (e) {
        screenImage = null;
      }
      if (!screenImage && captureAttempts < maxCaptureAttempts) {
        try {
          images.requestScreenCapture(false);
        } catch (e) {
          // Non-fatal
        }
        sleep(2000);
      }
    }

    if (!screenImage) {
      console.error("startScanning: captureScreen failed after " + maxCaptureAttempts + " attempts — skipping frame");
      floatyMod.appendLog(floatyW, "Capture failed, skipping frame");
      continue;
    }

    try {
      var matches = detection.findTemplates(screenImage, templates, config);
      if (matches && matches.length > 0) {
        var match = matches[0];
        console.info("startScanning: found \"" + match.templateName +
          "\" at (" + match.x + ", " + match.y +
          ") confidence=" + match.confidence.toFixed(3));
        floatyMod.updateStatus(floatyW, "Mushroom Found!");
        floatyMod.showDuringScan(floatyW, true);
        _scanning = false;
        onFound(match);
        return;
      }

      // No mushroom found — check "others" map-content indicator templates.
      // If any match, the map still has potential content (seeds, decor, etc.)
      // and we reset the empty-scroll counter.  If none match for N consecutive
      // scrolls, the map area is empty — reposition by clicking own position.
      if (othersTemplates.length > 0) {
        var othersResult = detection.findTemplates(screenImage, othersTemplates, config);
        if (othersResult && othersResult.length > 0) {
          _emptyScrollCount = 0;
        } else {
          _emptyScrollCount++;
          floatyMod.appendLog(floatyW, "Empty scroll #" + _emptyScrollCount + "/" + maxEmptyScrolls);
        }

        if (_emptyScrollCount >= maxEmptyScrolls) {
          floatyMod.appendLog(floatyW, "Map area empty — repositioning to own position");
          _emptyScrollCount = 0;
          navigator.waitForAndClickOwnPosition(navTemplates, floatyW);
          _scrollDirection *= -1;
          floatyMod.appendLog(floatyW, "Switched direction: now scrolling " +
            (_scrollDirection === -1 ? "LEFT" : "RIGHT"));
        }
      }
    } finally {
      screenImage.recycle();
    }
  }

  _scanning = false;
  floatyMod.updateStatus(floatyW, "Stopped");
  floatyMod.showDuringScan(floatyW, true);
}

/**
 * Request a graceful stop of the scan loop at the next safe opportunity.
 */
function stopScanning() {
  _shutdownRequested = true;
  _userStopped = true;
}

/**
 * Check whether the last scan stop was triggered by the user pressing Stop.
 * @returns {boolean}
 */
function wasUserStop() {
  return _userStopped;
}

/**
 * Check whether the scanner is currently running.
 * @returns {boolean}
 */
function isScanning() {
  return _scanning;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  startScanning: startScanning,
  stopScanning: stopScanning,
  isScanning: isScanning,
  wasUserStop: wasUserStop,
};
