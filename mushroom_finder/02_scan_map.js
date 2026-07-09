/**
 * mushroom_finder/02_scan_map.js — Scan loop (Phase 2)
 *
 * Orchestrates the full scan cycle: capture screen, run detection,
 * compile results, and fire callbacks when mushrooms with free
 * slots are found.
 *
 * Scan pattern: horizontal zigzag at fixed finger Y — sweep left until
 * empty, re-center, sweep right until empty, then vertically scroll the
 * map down to expose a new area and repeat.  The vertical scroll count
 * increases each cycle (1×, 2×, 3×, …) so coverage expands outward.
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

  // Scan Y coordinate — fixed at 42% of screen height.
  // Horizontal sweeps always happen at this Y.  When both left and right
  // sides are exhausted, the scanner vertically scrolls the map down
  // (swipe gesture) to see a new area, with the scroll count increasing
  // progressively (1×, 2×, 3×, …) so coverage expands outward.
  var currentY = Math.round(device.height * 0.42);
  var verticalShiftPercent = config.scan.verticalShiftPercent || 0.6;

  // Scan phase: "left" = sweeping left from player; "right" = sweeping right
  var scanPhase = "left";
  var verticalScrollCount = 1;

  console.info("DEBUG: device.width=" + device.width + ", device.height=" + device.height);
  console.info("DEBUG: currentY=" + currentY + ", settleDelay=" + settleDelay);

  // ── Helper: capture screen and detect mushrooms ──────────────────────
  // Returns true if a mushroom was found (calls onFound and sets _scanning=false).
  // If no mushroom found, updates sideEmpty state (empty scroll counts / direction).
  function _captureAndDetect(isPreScan) {
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
      console.error("_captureAndDetect: captureScreen failed after " + maxCaptureAttempts + " attempts — skipping frame");
      floatyMod.appendLog(floatyW, "Capture failed, skipping frame");
      return false;
    }

    try {
      var matches = detection.findTemplates(screenImage, templates, config);
      if (matches && matches.length > 0) {
        var match = matches[0];
        console.info("_captureAndDetect: found \"" + match.templateName +
          "\" at (" + match.x + ", " + match.y +
          ") confidence=" + match.confidence.toFixed(3));
        floatyMod.updateStatus(floatyW, "Mushroom Found!");
        floatyMod.showDuringScan(floatyW, true);
        _scanning = false;
        onFound(match);
        return true;
      }

      // No mushroom — check if the current area is "empty" (only after swipe,
      // not during pre-scan where we're checking the starting position).
      if (!isPreScan) {
        var sideEmpty = false;

        if (othersTemplates.length > 0) {
          var othersResult = detection.findTemplates(screenImage, othersTemplates, config);
          if (othersResult && othersResult.length > 0) {
            _emptyScrollCount = 0;
          } else {
            _emptyScrollCount++;
            floatyMod.appendLog(floatyW, "Empty scroll #" + _emptyScrollCount + "/" + maxEmptyScrolls);
          }
          sideEmpty = (_emptyScrollCount >= maxEmptyScrolls);
        } else {
          _emptyScrollCount++;
          floatyMod.appendLog(floatyW, "Sweep #" + _emptyScrollCount + "/" + maxEmptyScrolls + " (no others templates)");
          sideEmpty = (_emptyScrollCount >= maxEmptyScrolls);
        }

        if (sideEmpty) {
          _emptyScrollCount = 0;

          if (scanPhase === "left") {
            floatyMod.appendLog(floatyW, "Left side empty — re-centering for right sweep");
            navigator.waitForAndClickOwnPosition(navTemplates, floatyW);
            sleep(2000);
            scanPhase = "right";
            floatyMod.appendLog(floatyW, "Resuming → at same Y");
          } else {
            floatyMod.appendLog(floatyW, "Right side empty — scrolling down " + verticalScrollCount + "×");
            navigator.waitForAndClickOwnPosition(navTemplates, floatyW);
            sleep(2000);
            scroll.scrollDown(verticalScrollCount, verticalShiftPercent, swipeDuration, floatyW);
            sleep(settleDelay);
            verticalScrollCount++;
            scanPhase = "left";
            floatyMod.appendLog(floatyW, "Resuming ← after scroll down");
          }
        }
      }
    } finally {
      screenImage.recycle();
    }
    return false;
  }

  // ── Pre-scan: check current screen BEFORE first swipe ────────────────
  // If a mushroom is already visible when scanning starts, we find it
  // immediately instead of swiping it away.
  floatyMod.appendLog(floatyW, "Checking current screen...");
  if (_captureAndDetect(true)) return;

  // ── Main scan loop — zigzag left/right, then vertical scroll ────────
  while (!_shutdownRequested && _scanning) {
    _totalSwipes++;

    if (scanPhase === "left") {
      console.info("DEBUG SWIPE: swipeNum=" + _totalSwipes + ", currentY=" + currentY +
        ", startX=" + Math.round(device.width * 0.2) +
        ", endX=" + Math.round(device.width * 0.8) + ", phase=←");

      scroll.scrollLeft(currentY, swipeDuration, floatyW,
        "Swipe " + _totalSwipes + " ←");
    } else {
      console.info("DEBUG SWIPE: swipeNum=" + _totalSwipes + ", currentY=" + currentY +
        ", startX=" + Math.round(device.width * 0.8) +
        ", endX=" + Math.round(device.width * 0.2) + ", phase=→");

      scroll.scrollRight(currentY, swipeDuration, floatyW,
        "Swipe " + _totalSwipes + " →");
    }

    sleep(settleDelay);

    if (_shutdownRequested) {
      break;
    }

    // Capture → detect (with empty-area check enabled)
    if (_captureAndDetect(false)) return;
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
