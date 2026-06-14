/**
 * scanner.js
 *
 * Orchestrates the full scan cycle: capture screen, run detection,
 * compile results, and fire callbacks when mushrooms with free
 * slots are found.
 *
 * Scan pattern: always scroll left, shift down per row.
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

var detection = require("./detection");
var floatyMod = require("./floaty");
var scroll = require("./scroll");

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

var _shutdownRequested = false;
var _userStopped = false;       // true when user explicitly pressed Stop
var _sweepCount = 0;
var _totalSwipes = 0;
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
    // Double press → force stop the entire script
    _shutdownRequested = true;
    engines.myEngine().stop();
  } else {
    // Single press → graceful stop (loop exits on next check)
    _shutdownRequested = true;
  }
  _lastKeyTime = now;
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start scanning the game map for mushrooms using a vertical zigzag pattern.
 *
 * The scan loop performs consecutive swipes in alternating directions,
 * captures the screen after each swipe, classifies the screen state,
 * and runs template matching. The loop stops when a mushroom is found,
 * the user presses the volume key, or an unrecoverable error occurs.
 *
 * @param {Object}   config    - Configuration object (from config.js).
 * @param {Object[]} templates - Template descriptors from loadAllTemplates().
 * @param {Function} onFound   - Callback invoked with the first match object
 *     when a mushroom is detected.
 * @param {Object}   floatyW   - Floaty window instance from createFloaty().
 */
function startScanning(config, templates, onFound, floatyW) {
  // ── Guard: empty templates ───────────────────────────────────────────
  if (!templates || templates.length === 0) {
    console.error("startScanning: templates array is empty, cannot scan");
    floatyMod.updateStatus(floatyW, "Error: No templates");
    return;
  }

  // ── Reset state for a fresh scan ─────────────────────────────────────
  _shutdownRequested = false;
  _userStopped = false;
  _sweepCount = 0;
  _totalSwipes = 0;
  _scanning = true;

  floatyMod.appendLog(floatyW, "Scan engine started");
  console.info("startScanning: entered scan loop");

  // Refresh capture session — the original session may have expired
  // during the long navigation phase.  Silently re-acquire so that
  // captureScreen() works in the scan loop.
  try {
    images.requestScreenCapture(false);
  } catch (e) {
    // Non-fatal — the existing session might still work.
  }

  // Keep the floaty panel visible during scan (user request)
  floatyMod.showDuringScan(floatyW, true);
  floatyMod.updateStatus(floatyW, "Searching...");

  var settleDelay = config.scan.settleDelay;
  var swipeDuration = config.scan.swipeDuration;
  // Swipe duration must never exceed 2000 ms
  if (swipeDuration > 2000) {
    swipeDuration = 2000;
  }
  // Enforce a minimum settle delay — 500ms is too short for the map
  // to render new tiles after a swipe.
  if (settleDelay < 1500) {
    floatyMod.appendLog(floatyW, "Note: settleDelay was " + settleDelay + "ms, raising to 1500ms for reliability");
    settleDelay = 1500;
  }

  // Vertical shift per row — 12 % of screen height keeps the swipe
  // comfortably within the visible display.
  var verticalShift = Math.round(device.height * 0.12);

  // Sweeps per row from config (default 3 if not set)
  var sweepsPerRow = config.scan.sweepCountPerRow || 3;

  console.info("DEBUG: device.width=" + device.width + ", device.height=" + device.height);
  console.info("DEBUG: verticalShift=" + verticalShift + ", settleDelay=" + settleDelay + ", sweepsPerRow=" + sweepsPerRow);

  // ── Main scan loop — sweep left, shift down, repeat ─────────────────
  //
  // All swipes scroll left so the visible area moves progressively
  // westward.  After sweepsPerRow swipes the Y shifts down a row.
  //
  while (!_shutdownRequested && _scanning) {
    // Y coordinate shifts down each row.  Start at 30% of screen height
    // (middle of visible map content area) and cap at 97% so the swipe
    // covers the full map height including the bottom edge.
    var currentY = Math.round(
      device.height * 0.30 + _sweepCount * verticalShift
    );
    if (currentY > device.height * 0.97) {
      currentY = Math.round(device.height * 0.97);
    }

    console.info("DEBUG ROW: _sweepCount=" + _sweepCount + ", currentY=" + currentY +
      ", sweepsPerRow=" + sweepsPerRow);

    for (var i = 0; i < sweepsPerRow; i++) {
      if (_shutdownRequested) {
        break;
      }

      console.info("DEBUG SWIPE: i=" + i + ", currentY=" + currentY +
        ", startX=" + Math.round(device.width * 0.2) +
        ", endX=" + Math.round(device.width * 0.8));

      scroll.scrollLeft(currentY, swipeDuration, floatyW,
        "Sweep " + (_sweepCount + 1) + "." + (i + 1));
      _totalSwipes++;

      // Let the map settle / render after the swipe
      sleep(settleDelay);

      // Final shutdown check before capture
      if (_shutdownRequested) {
        break;
      }

      // ── Capture → detect cycle ───────────────────────────────────
      //
      // 1. captureScreen() with multiple retries on failure
      // 2. findMushrooms() — stop on first match
      //

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
          // Session may have expired — refresh and retry
          try {
            images.requestScreenCapture(false);
          } catch (e) {
            // Non-fatal
          }
          sleep(2000);
        }
      }

      if (!screenImage) {
        console.error(
          "startScanning: captureScreen failed after " +
          maxCaptureAttempts + " attempts — skipping frame"
        );
        floatyMod.appendLog(floatyW,
          "Capture failed, skipping frame");
        // Do NOT abort the scan — just skip this frame and swipe again
        continue;
      }

      // Process the captured image — ALWAYS recycled in finally
      try {
        // Run template matching on every frame regardless of screen state.
        // classifyScreenState is unreliable for some map views (e.g. map_view3),
        // so we always try detection and let the template matching sort it out.
        var matches = detection.findMushrooms(
          screenImage, templates, config
        );

        if (matches && matches.length > 0) {
          var match = matches[0];
          console.info(
            "startScanning: found \"" + match.templateName +
            "\" at (" + match.x + ", " + match.y +
            ") confidence=" + match.confidence.toFixed(3)
          );
          floatyMod.updateStatus(floatyW, "Mushroom Found!");
          floatyMod.showDuringScan(floatyW, true);
          _scanning = false;
          onFound(match);
          return;
        }
      } finally {
        // Ensure the screen image is always recycled
        screenImage.recycle();
      }
    }

    // Advance to the next sweep row
    _sweepCount++;
  }

  // ── Graceful stop (single volume press or external shutdown signal) ──
  _scanning = false;
  floatyMod.updateStatus(floatyW, "Stopped");
  floatyMod.showDuringScan(floatyW, true);
}

/**
 * Request a graceful stop of the scan loop at the next safe opportunity.
 *
 * The currently running swipe / capture cycle completes, then the loop
 * exits and the floaty overlay is restored.
 */
function stopScanning() {
  _shutdownRequested = true;
  _userStopped = true;
}

/**
 * Check whether the last scan stop was triggered by the user pressing Stop
 * (as opposed to finding a mushroom or an error).
 *
 * @returns {boolean} true if the user explicitly stopped the scan
 */
function wasUserStop() {
  return _userStopped;
}

/**
 * Check whether the scanner is currently running.
 *
 * @returns {boolean} true if a scan cycle is in progress.
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
