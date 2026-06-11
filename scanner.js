/**
 * scanner.js
 *
 * Orchestrates the full scan cycle: capture screen, run detection,
 * compile results, and fire callbacks when mushrooms with free
 * slots are found.
 *
 * Scan pattern: vertical zigzag — left sweep × 3 → shift down →
 * right sweep × 3 → shift down → repeat.
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

var utils = require("./utils");
var detection = require("./detection");
var floatyMod = require("./floaty");

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

var _shutdownRequested = false;
var _sweepCount = 0;
var _totalSwipes = 0;
var _consecutiveBadState = 0;
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
  _sweepCount = 0;
  _totalSwipes = 0;
  _consecutiveBadState = 0;
  _scanning = true;

  // Hide floaty during scan so it does not interfere with swipe gestures
  floatyMod.showDuringScan(floatyW, false);
  floatyMod.updateStatus(floatyW, "Searching...");

  var settleDelay = config.scan.settleDelay;
  var swipeDuration = config.scan.swipeDuration;
  // Swipe duration must never exceed 2000 ms
  if (swipeDuration > 2000) {
    swipeDuration = 2000;
  }
  var verticalShift = config.scan.verticalShiftPercent * device.height;

  // ── Main scan loop — vertical zigzag pattern ─────────────────────────
  //
  // Pattern: left sweep × 3 → shift down → right sweep × 3 → shift down
  // Even _sweepCount → left sweep; odd _sweepCount → right sweep.
  //
  while (!_shutdownRequested && _scanning) {
    var isLeftSweep = (_sweepCount % 2 === 0);
    // Y coordinate shifts after each complete sweep
    var currentY = Math.round(
      device.height * 0.5 + _sweepCount * verticalShift
    );

    // Each sweep = 3 consecutive swipes in one direction
    var sweepsPerRow = config.scan.sweepCountPerRow || 3;
    for (var i = 0; i < sweepsPerRow; i++) {
      if (_shutdownRequested) {
        break;
      }

      // ── Compute swipe endpoints ──────────────────────────────────
      var startX, endX;
      if (isLeftSweep) {
        startX = Math.round(device.width * 0.8);
        endX  = Math.round(device.width * 0.2);
      } else {
        startX = Math.round(device.width * 0.2);
        endX  = Math.round(device.width * 0.8);
      }

      // Execute the swipe gesture
      swipe(startX, currentY, endX, currentY, swipeDuration);
      _totalSwipes++;

      // Let the map settle / render after the swipe
      sleep(settleDelay);

      // Final shutdown check before capture
      if (_shutdownRequested) {
        break;
      }

      // ── Capture → detect cycle ───────────────────────────────────
      //
      // 1. captureScreen() with one retry on failure
      // 2. classifyScreenState() — skip detection if not map_visible
      // 3. findMushrooms() — stop on first match
      //

      var screenImage = null;
      try {
        screenImage = captureScreen();
      } catch (e) {
        screenImage = null;
      }

      // Retry once after a short delay if capture returned null
      if (!screenImage) {
        sleep(2000);
        try {
          screenImage = captureScreen();
        } catch (e) {
          screenImage = null;
        }
      }

      if (!screenImage) {
        console.error(
          "startScanning: captureScreen failed after retry"
        );
        floatyMod.updateStatus(floatyW, "Error: Capture failed");
        floatyMod.showDuringScan(floatyW, true);
        _scanning = false;
        return;
      }

      // Process the captured image — ALWAYS recycled in finally
      try {
        var state = utils.classifyScreenState(screenImage);

        if (state !== "map_visible") {
          _consecutiveBadState++;
          console.warn(
            "startScanning: screen state \"" + state +
            "\" (consecutive bad: " + _consecutiveBadState + ")"
          );
          if (_consecutiveBadState >= 3) {
            console.warn(
              "startScanning: 3 consecutive non-map_visible " +
              "states — continuing scan"
            );
          }
          // Skip detection for this frame; go to next swipe
          continue;
        }

        // Screen shows the game map — reset bad-state counter
        _consecutiveBadState = 0;

        // Run template matching on the captured frame
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
};
