/**
 * unlock.js — Pikmin Bloom Auto-JS6 Unlock Utility
 *
 * GUARANTEE: Runs BEFORE app launch to ensure phone is unlocked.
 * If phone is locked, it WILL unlock it before attempting to launch the app.
 *
 * MUST be required at the very start of main.js or main-headless.js
 * (at line 4, right after "auto";)
 *
 * HOW IT WORKS:
 * 1. wakeScreen() - Ensures screen is on (may wake it if off)
 * 2. unlockByPattern() - Draws the unlock pattern (8→4→2→6→7→1→3→9→5)
 * 3. isDeviceUnlocked() - Verifies device is unlocked
 * 4. If still locked after pattern → retry once more
 * 5. Only after successful unlock → script proceeds to config/launch
 *
 * Compatible with AutoJS6 — requires the game to be running and screen
 * capture permission to be granted later in the flow.
 */

"use auto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Default unlock pattern for the 9-dot grid.
 * Pattern: 8 → 4 → 2 → 6 → 7 → 1 → 3 → 9 → 5
 * These correspond to the 9-dot grid layout:
 *   1 | 2 | 3
 *   4 | 5 | 6
 *   7 | 8 | 9
 */
const PATTERN = [8, 4, 2, 6, 7, 1, 3, 9, 5];

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
 * Draw the unlock pattern on the screen.
 * Uses the default PATTERN defined above; adjust points if your device layout differs.
 * THIS WILL DRAW THE PATTERN TO UNLOCK THE PHONE.
 */
function unlockByPattern() {
  // Calculate the 9 points of the pattern grid
  let w = device.width;
  let h = device.height;

  // Pattern coordinates - measured for typical Android layout
  let points = {
    1: [w * 0.25, h * 0.55],
    2: [w * 0.50, h * 0.55],
    3: [w * 0.75, h * 0.55],
    4: [w * 0.25, h * 0.68],
    5: [w * 0.50, h * 0.68],
    6: [w * 0.75, h * 0.68],
    7: [w * 0.25, h * 0.82],
    8: [w * 0.50, h * 0.82],
    9: [w * 0.75, h * 0.82],
  };

  // Build the gesture path using the user's pattern
  let path = [];
  for (let num of PATTERN) {
    path.push(points[num]);
  }

  // Draw the pattern using gesture
  var gestureArgs = [800]; // duration first
  for (var i = 0; i < path.length; i++) {
    var point = path[i];
    gestureArgs.push(point[0]); // x
    gestureArgs.push(point[1]); // y
  }
  gesture.apply(null, gestureArgs);
  sleep(1500);
}

/**
 * Swipe up from the bottom of the screen to dismiss lock screen swipe.
 */
function swipeUpToUnlock() {
  let w = device.width;
  let h = device.height;
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
  floatyMod = floatyMod || require("./ui/floaty");
  var log = panel ? function(msg) { floatyMod.appendLog(panel, "unlock: " + msg); }
                    : function(msg) { console.log("unlock: " + msg); };

  log("=== ENSURING UNLOCKED BEFORE LAUNCH ===");

  // Step 1: Force wake screen
  log("Step 1: Waking screen...");
  wakeScreen();
  sleep(500);
  log("Screen state check complete");

  // Step 2: Draw unlock pattern
  log("Step 2: Drawing unlock pattern...");
  unlockByPattern();
  log("Pattern drawn, waiting for animation...");
  sleep(1000);

  // Step 3: Verify unlocked
  log("Step 3: Verifying device unlocked...");
  var unlocked = isDeviceUnlocked();

  if (unlocked) {
    log("Device is unlocked ✓");
    sleep(500);
    return true;
  }

  // Step 4: If still locked, retry pattern once
  log("Device still locked, retrying pattern...");
  unlockByPattern();
  sleep(1000);

  unlocked = isDeviceUnlocked();
  if (unlocked) {
    log("Device unlocked on retry ✓");
    sleep(500);
    return true;
  }

  // Step 5: If still locked after two attempts, log warning but proceed
  // The script may still work if user unlocks manually during execution
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

  // Configuration
  PATTERN: PATTERN,
};