/**
 * lib/clear_memory.js — Clear the previous app instance before launching
 *
 * Ported from the Pokemon TCGP project's killApp() flow.  The game is closed
 * through the Android recent-apps screen: the close (X) button on the top
 * task card is matched from templates/android/ and tapped, then the package
 * is force-stopped so the next launch starts from a cold state.
 *
 * The templates are the system close buttons (a light X on dark and a dark X
 * on light).  Matching both covers the light and dark recents themes.
 *
 * Every step is best-effort: a missing template, a denied shell command or an
 * unavailable recents screen is logged and the launch continues.
 *
 * Exports:
 *   clearAppMemory(packageName, templateDir, panel) → boolean
 *     true when the close button was found and tapped.
 */

"use auto";

var floatyMod   = require("../ui/floaty");
var gesturesMod = require("./gestures");
var matcherMod  = require("./matcher");

/** AutoJS6 package — brought to the foreground so the game leaves it. */
var AUTOJS_PACKAGE = "org.autojs.autojs6";

/** How many times the recents screen is scanned for the close button. */
var MAX_RETRIES = 10;

/** Minimum similarity for a close-button candidate. */
var MATCH_THRESHOLD = 0.7;

function _log(panel, msg) {
  if (panel) {
    floatyMod.appendLog(panel, msg);
  } else {
    console.info("[clear_memory] " + msg);
  }
}

/**
 * Find the close (X) button on the current screen.
 *
 * Uses images.matchTemplate when available — it reports the similarity of the
 * best candidate even when it is below the threshold — and falls back to
 * images.findImage otherwise.
 *
 * @param {Image} screenImage - Captured screen.
 * @param {Object[]} templates - Template descriptors to match.
 * @returns {Object|null} {x, y, score, name} of the best candidate.
 */
function _findCloseButton(screenImage, templates) {
  var best = null;
  var bestTpl = null;
  var useMatchTemplate = typeof images.matchTemplate === "function";
  var region = [0, 0, device.width, device.height];

  for (var i = 0; i < templates.length; i++) {
    var tpl = templates[i];
    var candidate = null;

    if (useMatchTemplate) {
      try {
        var result = images.matchTemplate(screenImage, tpl.image, {
          threshold: MATCH_THRESHOLD,
          region: region,
          max: 1
        });
        if (result && result.matches && result.matches.length > 0) {
          var hit = result.matches[0];
          candidate = { x: hit.point.x, y: hit.point.y, score: hit.similarity };
        }
      } catch (e) {
        console.warn("[clear_memory] matchTemplate failed for '" + tpl.name + "': " + e);
        useMatchTemplate = false;
      }
    }

    if (!candidate) {
      try {
        var found = images.findImage(screenImage, tpl.image, {
          threshold: MATCH_THRESHOLD,
          region: region
        });
        if (found) {
          candidate = { x: found.x, y: found.y, score: found.confidence };
        }
      } catch (e2) {
        console.warn("[clear_memory] findImage failed for '" + tpl.name + "': " + e2);
      }
    }

    if (candidate && (!best || candidate.score > best.score)) {
      best = candidate;
      bestTpl = tpl;
    }
  }

  if (!best) return null;
  return {
    x: Math.round(best.x + bestTpl.w / 2),
    y: Math.round(best.y + bestTpl.h / 2),
    score: best.score,
    name: bestTpl.name
  };
}

/**
 * Close the running app instance so the next launch starts cold.
 *
 * @param {string} packageName - Package to force-stop, e.g. "com.nianticlabs.pikmin".
 * @param {string} templateDir - Root templates directory (e.g. "./templates/").
 * @param {Object} [panel] - Floaty panel for logging.
 * @returns {boolean} true when the close button was tapped.
 */
function clearAppMemory(packageName, templateDir, panel) {
  _log(panel, "Preparing to clear memory before launch...");

  try {
    app.launchPackage(AUTOJS_PACKAGE);
  } catch (e) {
    _log(panel, "Failed to launch AutoJS6: " + e);
  }
  sleep(3000);

  // HOME first so recents opens over the launcher — calling recents() while
  // another app is foreground renders the recents view unreliably.
  _log(panel, "Going home before opening recent apps...");
  home();
  sleep(2000);

  _log(panel, "Opening recent apps to clear memory...");
  try {
    recents();
  } catch (e) {
    _log(panel, "recents() failed: " + e);
  }
  sleep(2000);

  var templates = matcherMod.loadAllTemplates(files.join(templateDir, "android"));
  var cleared = false;

  if (templates.length === 0) {
    _log(panel, "Clear memory template not found in templates/android/ — skipping tap");
  } else {
    var names = [];
    for (var n = 0; n < templates.length; n++) {
      names.push(templates[n].name);
    }
    _log(panel, "Clear memory templates loaded (" + templates.length + "): " + names.join(", "));

    for (var retry = 0; retry < MAX_RETRIES && !cleared; retry++) {
      _log(panel, "Capturing screen to find close button (attempt " +
        (retry + 1) + "/" + MAX_RETRIES + ")...");

      var screen = null;
      floatyMod.withPanelHidden(panel, function() {
        try {
          screen = captureScreen();
        } catch (e) {
          screen = null;
        }
      });

      if (!screen) {
        _log(panel, "Screen capture failed, retrying...");
        sleep(1000);
        continue;
      }

      var hit = null;
      try {
        floatyMod.withPanelHidden(panel, function() {
          hit = _findCloseButton(screen, templates);
        });
      } finally {
        screen.recycle();
      }

      if (hit) {
        _log(panel, "Found close button via '" + hit.name + "' at (" + hit.x + "," + hit.y +
          ", rate " + hit.score.toFixed(2) + "), tapping...");
        floatyMod.withPanelHidden(panel, function() {
          gesturesMod.tap(hit.x, hit.y, 300, panel);
        });
        cleared = true;
        sleep(1000);
        break;
      }

      _log(panel, "Close button not found with " + templates.length + " template(s), retrying...");
      sleep(1000);

      if (retry === 3) {
        _log(panel, "Re-opening recent apps...");
        home();
        sleep(2000);
        try {
          recents();
        } catch (e) {
          _log(panel, "recents() failed: " + e);
        }
        sleep(2000);
      }
    }

    matcherMod.recycleAllTemplates(templates);
  }

  if (!cleared) {
    _log(panel, "Failed to clear memory after " + MAX_RETRIES + " attempts, proceeding anyway...");
  }

  _log(panel, "Killing " + packageName + " to free memory...");
  try {
    shell("input keyevent 3", true);
  } catch (e) {
    _log(panel, "HOME keyevent failed: " + e);
  }
  sleep(1500);

  try {
    var res = shell("am force-stop " + packageName, true);
    if (res && res.code === 0) {
      _log(panel, "Stopped " + packageName + " successfully");
    } else {
      _log(panel, "force-stop failed: " + (res ? res.error : "unknown error") +
        " — trying --user all");
      var res2 = shell("am force-stop --user all " + packageName, true);
      if (res2 && res2.code === 0) {
        _log(panel, "force-stop --user all succeeded");
      } else {
        _log(panel, "--user all also failed: " + (res2 ? res2.error : "unknown error"));
      }
    }
  } catch (e) {
    _log(panel, "force-stop threw: " + e + " — continuing");
  }

  sleep(2000);
  return cleared;
}

module.exports = {
  clearAppMemory: clearAppMemory
};
