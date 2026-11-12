"auto";

/**
 * lib/lock_screen.js — Reliable screen locking utility
 *
 * Tries multiple methods in order of reliability:
 *   1. AccessibilityService GLOBAL_ACTION_LOCK_SCREEN (most reliable, requires accessibility)
 *   2. shell input keyevent 26 (may fail without WRITE_SECURE_SETTINGS)
 *   3. shell input keyevent KEYCODE_POWER (string form)
 *   4. shell input keyevent --longpress 26 (long-press variant)
 *   5. KeyCode.KEYCODE_POWER via shell
 *
 * Returns true if the screen is actually off (verified via device.isScreenOn()).
 *
 * Exports:
 *   lockScreenAndExit() — lock screen then exit
 *   lockScreen() — lock screen only (returns success boolean)
 *   isScreenOn() — wrapper around device.isScreenOn()
 */

var TAG = "[lock_screen]";

function _log(msg) {
  console.info(TAG + " " + msg);
}

function _warn(msg) {
  console.warn(TAG + " " + msg);
}

function _isScreenOn() {
  try {
    return typeof device.isScreenOn === "function" && device.isScreenOn();
  } catch (e) {
    return false;
  }
}

/**
 * Lock screen using AccessibilityService (most reliable method — confirmed working).
 */
function _lockViaAccessibility() {
  try {
    if (typeof runtime === "undefined") return false;
    if (typeof runtime.accessibilityBridge === "undefined") return false;
    if (typeof runtime.accessibilityBridge.getService !== "function") return false;
    var svc = runtime.accessibilityBridge.getService();
    if (!svc) return false;
    var success = svc.performGlobalAction(
      android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN
    );
    return success === true;
  } catch (e) {
    _warn("Accessibility lock failed: " + e);
    return false;
  }
}

function _lockViaShell(cmd) {
  try {
    shell(cmd);
    return true;
  } catch (e) {
    _warn("Shell command '" + cmd + "' failed: " + e);
    return false;
  }
}

/**
 * Try all lock methods in order. Returns true if the screen is actually off.
 */
function lockScreen() {
  if (!_isScreenOn()) {
    _log("Screen already off");
    return true;
  }

  var methods = [
    { name: "accessibility GLOBAL_ACTION_LOCK_SCREEN", fn: _lockViaAccessibility },
    { name: "shell input keyevent 26", fn: function() { return _lockViaShell("input keyevent 26"); } },
    { name: "shell input keyevent KEYCODE_POWER", fn: function() { return _lockViaShell("input keyevent KEYCODE_POWER"); } },
    { name: "shell input keyevent --longpress 26", fn: function() { return _lockViaShell("input keyevent --longpress 26"); } },
    { name: "KeyCode.KEYCODE_POWER via shell", fn: function() {
      var kc = (typeof KeyCode !== "undefined") ? KeyCode.KEYCODE_POWER : 26;
      return _lockViaShell("input keyevent " + kc);
    } }
  ];

  for (var i = 0; i < methods.length; i++) {
    _log("Trying: " + methods[i].name);
    try {
      var invoked = methods[i].fn();
      if (invoked === false) continue;
      sleep(2500);
      if (!_isScreenOn()) {
        _log("Screen locked via: " + methods[i].name);
        return true;
      } else {
        _warn("Method did not turn screen off: " + methods[i].name);
      }
    } catch (e) {
      _warn("Method " + methods[i].name + " threw: " + e);
    }
  }

  _warn("All lock methods failed — screen still on");
  return false;
}

/**
 * Lock the screen, then exit the script.
 */
function lockScreenAndExit() {
  _log("Locking screen before exit...");
  lockScreen();
  sleep(500);
  exit();
}

module.exports = {
  lockScreen: lockScreen,
  lockScreenAndExit: lockScreenAndExit,
  isScreenOn: _isScreenOn
};