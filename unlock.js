/**
 * unlock.js — Pikmin Bloom Auto-JS6 Unlock Utility
 *
 * Runs BEFORE app launch. When the screen is off, it wakes the device and
 * draws the user's unlock pattern.
 *
 * The pattern is NOT stored in this file. It is entered once in the settings
 * dialog and persisted on-device via settings_store ("unlockPattern").
 * With no pattern configured, a swipe-up gesture is attempted instead.
 *
 * HOW IT WORKS:
 * 1. getUnlockPattern() - Reads the pattern from on-device settings
 * 2. wakeScreen() - Ensures screen is on (may wake it if off)
 * 3. swipeUpToUnlock() - Swipes up to reveal the pattern entry screen
 * 4. unlockByPattern() - Draws the configured pattern
 * 5. isDeviceUnlocked() - Verifies device is unlocked
 * 6. If still locked → retry once more
 *
 * Compatible with AutoJS6.
 */

"use auto";

var floatyMod = require("./ui/floaty");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getUnlockPattern() {
  var pattern = [];
  try {
    var saved = require("./ui/settings_store").load();
    if (saved && Array.isArray(saved.unlockPattern)) pattern = saved.unlockPattern;
  } catch (e) {
    console.warn("unlock: could not read saved settings: " + e);
  }
  if (pattern.length < 4) {
    try {
      var cfg = require("./ui/config");
      pattern = (cfg && cfg.unlock && Array.isArray(cfg.unlock.pattern)) ? cfg.unlock.pattern : [];
    } catch (e2) {
      pattern = [];
    }
  }

  var valid = [];
  for (var i = 0; i < pattern.length && valid.length < 9; i++) {
    var n = parseInt(pattern[i], 10);
    if (n >= 1 && n <= 9 && valid.indexOf(n) === -1) valid.push(n);
  }
  return valid;
}

// Rows as a fraction of screen height. "middle" is calibrated on a 1080×2400
// lock screen: dot rows at y=1155 / 1427.5 / 1700 px.
var GRID_ROWS = {
  down: [0.55, 0.68, 0.82],
  middle: [1155 / 2400, 1427.5 / 2400, 1700 / 2400],
};
var GRID_COLS = [0.25, 0.5, 0.75];

function getUnlockGridPosition() {
  var pos = null;
  try {
    var saved = require("./ui/settings_store").load();
    if (saved) pos = saved.unlockGridPosition;
  } catch (e) {
    console.warn("unlock: could not read saved grid position: " + e);
  }
  if (pos !== "middle" && pos !== "down") {
    try {
      var cfg = require("./ui/config");
      pos = (cfg && cfg.unlock) ? cfg.unlock.gridPosition : null;
    } catch (e2) {
      pos = null;
    }
  }
  return pos === "middle" ? "middle" : "down";
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Wake the device screen if it's off.
 * Some devices require two wake calls to reliably turn the screen on.
 * THIS WILL WAKE THE SCREEN IF IT'S OFF.
 */
function wakeScreen() {
  // Force wake - some devices need this even if appears on
  if (!device.isScreenOn()) {
    device.wakeUp();
    sleep(1200);
  }
  // Second wake call - some Android devices need two
  if (!device.isScreenOn()) {
    device.wakeUp();
    sleep(800);
  }
  // Even if still reporting off, try a touch to ensure on
  if (!device.isScreenOn()) {
    // Try pressing center of screen to wake
    var cx = Math.round(device.width / 2);
    var cy = Math.round(device.height / 2);
    press(cx, cy, 100);
    sleep(1000);
  }
}

/**
 * Draw the configured unlock pattern on the screen.
 * Coordinates target a typical 3x3 pattern grid; adjust if the layout differs.
 *
 * @param {number[]} [pattern] - Pattern digits; defaults to the saved settings value.
 * @returns {boolean} true when a gesture was drawn.
 */
function unlockByPattern(pattern) {
  pattern = pattern || getUnlockPattern();
  if (!pattern || pattern.length < 2) {
    console.warn("unlock: no unlock pattern configured in settings — skipping pattern draw");
    return false;
  }

  var w = device.width;
  var h = device.height;
  var rows = GRID_ROWS[getUnlockGridPosition()];

  var points = {};
  for (var d = 1; d <= 9; d++) {
    points[d] = [Math.round(w * GRID_COLS[(d - 1) % 3]), Math.round(h * rows[Math.floor((d - 1) / 3)])];
  }

  var path = [];
  for (var p = 0; p < pattern.length; p++) {
    var point = points[pattern[p]];
    if (point) path.push(point);
  }

  var gestureArgs = [800];
  for (var i = 0; i < path.length; i++) {
    gestureArgs.push(path[i][0]);
    gestureArgs.push(path[i][1]);
  }
  gesture.apply(null, gestureArgs);
  sleep(1500);
  return true;
}

/**
 * Swipe up from the bottom of the screen to dismiss lock screen swipe.
 */
function swipeUpToUnlock() {
  var w = device.width;
  var h = device.height;
  // Swipe from bottom to up (adjust if needed)
  swipe(w / 2, h * 0.85, w / 2, h * 0.25, 600);
  sleep(1000);
}

/**
 * Check if the device is considered unlocked.
 * Looks for lock screen indicators to determine if unlock is needed.
 *
 * @returns {boolean} true if the device is unlocked
 */
function isDeviceUnlocked() {
  // Check for lock screen text/description
  var lockText = textMatches(/(紧急呼叫|Emergency|输入密码|输入PIN|图案解锁|Pattern|解锁)/).exists();
  if (lockText) {
    return false;
  }
  var lockDesc = descMatches(/(紧急呼叫|Emergency)/).exists();
  if (lockDesc) {
    return false;
  }
  // If no lock indicators found, consider it unlocked
  return true;
}

// ---------------------------------------------------------------------------
// Sequence Functions
// ---------------------------------------------------------------------------

/**
 * Full unlock sequence guaranteed to run BEFORE app launch.
 * This is the main entry point for ensuring the phone is unlocked.
 *
 * @param {Object} [panel] - Optional floaty panel for logging (default: null)
 * @returns {boolean} true if device is unlocked and ready
 */
function ensureUnlockedBeforeLaunch(panel) {
  var log = panel ? function(msg) { floatyMod.appendLog(panel, "unlock: " + msg); }
                    : function(msg) { console.log("unlock: " + msg); };

  log("=== ENSURING UNLOCKED BEFORE LAUNCH ===");

  if (device.isScreenOn()) {
    log("Screen is ON — skipping unlock sequence");
    return true;
  }

  log("Screen is OFF — running unlock sequence...");

  log("Step 1: Waking screen...");
  wakeScreen();
  log("Screen state check complete");
  sleep(2000);

  log("Step 2: Swiping up to reveal unlock screen...");
  swipeUpToUnlock();
  log("Swipe up gesture sent");

  var pattern = getUnlockPattern();
  if (pattern.length > 0) {
    log("Step 3: Drawing configured unlock pattern (" + pattern.length + " dots, " +
        getUnlockGridPosition() + " grid)...");
    unlockByPattern(pattern);
  } else {
    log("Step 3: No unlock pattern configured — swipe up only");
    log("Set one in the settings dialog to enable pattern unlock");
  }
  log("Unlock gesture sent, waiting for animation...");
  sleep(1000);

  log("Step 4: Verifying device unlocked...");
  var unlocked = isDeviceUnlocked();

  if (unlocked) {
    log("Device is unlocked ✓");
    sleep(500);
    return true;
  }

  log("Device still locked, retrying unlock gesture...");
  if (pattern.length > 0) {
    unlockByPattern(pattern);
  } else {
    swipeUpToUnlock();
  }
  sleep(1000);

  unlocked = isDeviceUnlocked();
  if (unlocked) {
    log("Device unlocked on retry ✓");
    sleep(500);
    return true;
  }

  log("WARNING: Device still locked after 2 attempts");
  log("The app may launch but screen interaction may fail");
  log("Please manually unlock your phone if needed");
  sleep(1000);

  return false; // Return false but don't crash the script
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Core functions
  wakeScreen: wakeScreen,
  unlockByPattern: unlockByPattern,
  swipeUpToUnlock: swipeUpToUnlock,
  isDeviceUnlocked: isDeviceUnlocked,

  // Main function: MUST be called at start of main.js / main-headless.js
  // Ensures phone is unlocked BEFORE app launch proceeds
  ensureUnlockedBeforeLaunch: ensureUnlockedBeforeLaunch,

  getUnlockPattern: getUnlockPattern,
  getUnlockGridPosition: getUnlockGridPosition,
};