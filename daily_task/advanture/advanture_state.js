/**
 * advanture/advanture_state.js — Adventure page state classification
 *
 * Common functions to check if the game is on the main page or
 * inside the adventure UI.
 *
 * Public API:
 *   isOnMainPage(navTemplates, options?)    → boolean
 *   isOnAdvanturePage(advNavTemplates, options?) → boolean
 */

"auto";

var floatyMod = require("../../ui/floaty");
var advConfig = require("../../ui/config");

// ── Click feedback indicator ─────────────────────────────────────────────
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

/**
 * Clamp Y to stay above navigation bar, then press.
 */
function _safePress(x, y, duration) {
  var navBarHeight = (advConfig.ui && advConfig.ui.navBarHeight) || Math.round(device.height * 0.07);
  var maxSafeY = device.height - navBarHeight;
  if (y > maxSafeY) y = maxSafeY;
  press(x, y, duration);
}

/**
 * Try to match a single template against the screen image.
 * @param {Image} screenImage - Current screenshot.
 * @param {{name: string, image: Image}} tpl - Template descriptor.
 * @param {number} [threshold=0.8] - Match confidence threshold.
 * @returns {{x: number, y: number, confidence: number}|null}
 */
function _matchOne(screenImage, tpl, threshold) {
  if (!screenImage || !tpl || !tpl.image) return null;
  try {
    var result = images.findImage(screenImage, tpl.image, {
      threshold: threshold || 0.8,
      region: [0, 0, screenImage.getWidth(), screenImage.getHeight()]
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

/**
 * Actively navigate to the main page by clicking dismiss templates until
 * the store indicator (template name containing "store") appears.
 *
 * @param {{name: string, image: Image, w: number, h: number}[]} navTemplates
 * @param {Object} [options]
 * @param {number} [options.threshold=0.7] - Match confidence threshold.
 * @param {number} [options.timeout=60000] - Max loop time in ms.
 * @param {Object} [options.floaty] - Floaty panel for appendLog().
 * @returns {boolean}
 */
function isOnMainPage(navTemplates, options) {
  if (!navTemplates || navTemplates.length === 0) return true;
  var opts = options || {};
  var threshold = opts.threshold || 0.7;
  var timeout = opts.timeout || 60000;
  var floaty = opts.floaty;
  // Use separate dismiss-only templates (common/) if provided; otherwise fall back to all navTemplates
  var dismissTemplates = opts.dismissTemplates || navTemplates;
  var deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) {
        sleep(500);
        continue;
      }

      // Check ALL templates for page indicators (store detector, advanture detector)
      for (var i = 0; i < navTemplates.length; i++) {
        var name = navTemplates[i].name.toLowerCase();
        if (name.indexOf("store detector") !== -1 || name.indexOf("advanture detector") !== -1) {
          var match = _matchOne(img, navTemplates[i], threshold);
          if (match) {
            console.info("isOnMainPage: " + navTemplates[i].name + " found, on target page");
            if (floaty) floatyMod.appendLog(floaty, "isOnMainPage: " + navTemplates[i].name + " found");
            return true;
          }
        }
      }

      // Only click dismiss templates (common/), NOT navigation templates (Map view, Go to map, etc.)
      // Priority: try non-Close/Back templates first, then Close/Back as last resort
      var clicked = false;

      // Pass 1: click any dismiss template that is NOT Close/Back variant
      for (var j = 0; j < dismissTemplates.length; j++) {
        var tplName = dismissTemplates[j].name.toLowerCase();
        if (tplName.indexOf("close") !== -1 || tplName.indexOf("back") !== -1) continue;
        if (tplName.indexOf("detector") === -1 && tplName.indexOf("page") === -1) {
          var dismissMatch = _matchOne(img, dismissTemplates[j], threshold);
          if (dismissMatch) {
            var tapX = dismissMatch.x + Math.round(dismissMatch.w / 2);
            var tapY = dismissMatch.y + Math.round(dismissMatch.h / 2);
            console.info("isOnMainPage: clicking \"" + dismissTemplates[j].name + "\" at (" + tapX + ", " + tapY + ")");
            if (floaty) floatyMod.appendLog(floaty, "isOnMainPage: clicking " + dismissTemplates[j].name);
            floatyMod.withPanelHidden(floaty, function() {
              _showTap(tapX, tapY);
              _safePress(tapX, tapY, 1000);
            });
            sleep(1500);
            clicked = true;
            break;
          }
        }
      }

      // Pass 2: last resort — click Close/Back variants (these may dismiss important UI)
      if (!clicked) {
        for (var j = 0; j < dismissTemplates.length; j++) {
          var tplName = dismissTemplates[j].name.toLowerCase();
          if (tplName.indexOf("close") === -1 && tplName.indexOf("back") === -1) continue;
          if (tplName.indexOf("detector") === -1 && tplName.indexOf("page") === -1) {
            var dismissMatch = _matchOne(img, dismissTemplates[j], threshold);
            if (dismissMatch) {
              var tapX = dismissMatch.x + Math.round(dismissMatch.w / 2);
              var tapY = dismissMatch.y + Math.round(dismissMatch.h / 2);
              console.info("isOnMainPage: clicking \"" + dismissTemplates[j].name + "\" at (" + tapX + ", " + tapY + ")");
              if (floaty) floatyMod.appendLog(floaty, "isOnMainPage: clicking " + dismissTemplates[j].name);
              floatyMod.withPanelHidden(floaty, function() {
                _showTap(tapX, tapY);
                press(tapX, tapY, 1000);
              });
              sleep(1500);
              clicked = true;
              break;
            }
          }
        }
      }

      if (!clicked) {
        sleep(1000);
      }
    } catch(e) {
      console.warn("isOnMainPage error: " + e);
      if (floaty) floatyMod.appendLog(floaty, "isOnMainPage error: " + e);
      sleep(1000);
    } finally {
      if (img) img.recycle();
    }
  }

  console.warn("isOnMainPage: timeout reached without finding store");
  if (floaty) floatyMod.appendLog(floaty, "isOnMainPage: timeout reached");
  return false;
}

/**
 * Actively navigate to the adventure page.
 *
 * 1. Check for "Advanture page.jpg" (from templates/navigation/) — if visible, we're on advanture page
 * 2. If NOT visible: navigate to main page first (reuse isOnMainPage logic)
 * 3. Then click "Advanture.jpg" (from templates/advanture/navigation/) to enter advanture
 * 4. Loop back to step 1
 *
 * @param {{name: string, image: Image, w: number, h: number}[]} mainTemplates - Combined navigation + common templates.
 * @param {{name: string, image: Image, w: number, h: number}[]} advNavTemplates - Adventure navigation templates.
 * @param {Object} [options]
 * @param {number} [options.threshold=0.7] - Match confidence threshold.
 * @param {number} [options.timeout=60000] - Max loop time in ms.
 * @param {Object} [options.floaty] - Floaty panel for appendLog().
 * @returns {boolean}
 */
function isOnAdvanturePage(mainTemplates, advNavTemplates, options) {
  if (!advNavTemplates || advNavTemplates.length === 0) return true;
  var opts = options || {};
  var threshold = opts.threshold || 0.7;
  var timeout = opts.timeout || 60000;
  var floaty = opts.floaty;
  var deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); continue; }

      // Step 1: Check if already on advanture page (look for "Advanture page" in mainTemplates)
      for (var i = 0; i < mainTemplates.length; i++) {
        var name = mainTemplates[i].name.toLowerCase();
        if (name.indexOf("advanture detector") !== -1) {
          var match = _matchOne(img, mainTemplates[i], threshold);
          if (match) {
            console.info("isOnAdvanturePage: Advanture page found");
            if (floaty) floatyMod.appendLog(floaty, "isOnAdvanturePage: Advanture page found");
            return true;
          }
        }
      }

      // Step 2: Not on advanture page — navigate to main page first
      // (reuse isOnMainPage logic: loop clicking dismiss templates until store.jpg found)
      var mainPageReached = isOnMainPage(mainTemplates, { threshold: threshold, timeout: 15000, floaty: floaty, dismissTemplates: opts.dismissTemplates });
      if (!mainPageReached) {
        // Couldn't reach main page — try again next loop iteration
        sleep(1000);
        continue;
      }

      // Step 3: On main page — click entry button(s) to enter advanture
      // Uses dedicated entry templates (Advanture.jpg, Collect.jpg, Mushroom.jpg) if provided
      var clicked = false;
      var entryList = opts.entryTemplates || mainTemplates;
      for (var j = 0; j < entryList.length; j++) {
        // If using mainTemplates (no dedicated entry templates), filter by name
        if (!opts.entryTemplates) {
          var checkName = entryList[j].name.toLowerCase();
          if (checkName.indexOf("advanture") === -1 ||
              checkName.indexOf("start") !== -1 ||
              checkName.indexOf("detector") !== -1 ||
              checkName.indexOf("page") !== -1) {
            continue;
          }
        }
        var img2 = null;
        try {
          img2 = captureScreen();
          if (!img2) break;
          var match = _matchOne(img2, entryList[j], threshold);
          if (match) {
            var tapX = match.x + Math.round(match.w / 2);
            var tapY = match.y + Math.round(match.h / 2);
            console.info("isOnAdvanturePage: clicking \"" + entryList[j].name + "\" at (" + tapX + "," + tapY + ")");
            if (floaty) floatyMod.appendLog(floaty, "Clicking " + entryList[j].name);
            floatyMod.withPanelHidden(floaty, function() {
              _showTap(tapX, tapY);
              _safePress(tapX, tapY, 1000);
            });
            sleep(2000);
            clicked = true;
            break;
          }
        } finally {
          if (img2) img2.recycle();
        }
      }

      if (!clicked) {
        console.info("isOnAdvanturePage: no entry button found to click");
        if (floaty) floatyMod.appendLog(floaty, "isOnAdvanturePage: no entry button found");
        sleep(1000);
      }

      // Loop back to step 1 (check if we're now on advanture page)

    } catch(e) {
      console.warn("isOnAdvanturePage error: " + e);
      if (floaty) floatyMod.appendLog(floaty, "isOnAdvanturePage error: " + e);
      sleep(1000);
    } finally {
      if (img) img.recycle();
    }
  }

  console.warn("isOnAdvanturePage: timeout reached");
  if (floaty) floatyMod.appendLog(floaty, "isOnAdvanturePage: timeout reached");
  return false;
}

module.exports = {
  isOnMainPage: isOnMainPage,
  isOnAdvanturePage: isOnAdvanturePage,
  showTap: _showTap
};
