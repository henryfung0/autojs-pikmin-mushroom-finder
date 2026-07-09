/**
 * mushroom_finder/01_navigate_to_map.js — Navigation phase (Phase 1)
 *
 * Navigates through Pikmin Bloom screens using template matching.
 * State machine handles: close buttons → menu → map view → game map.
 *
 * Navigation templates go in ./templates/navigation/ subfolder:
 *   close1.jpg / close2.jpg   - Dismiss overlays/popups
 *   go_to_map.jpg              - Button to enter the map
 *   map_view.jpg               - Intermediate map screen
 *   map_view2.jpg              - Button to click when map_view is shown
 *
 * Exports:
 *   loadNavigationTemplates(templateDir)  → {name, image, w, h}[]
 *   navigateToMap(navTemplates, config)   → boolean (true = map reached)
 */

"auto";

var floatyMod = require("../ui/floaty");

// ── Click feedback indicator ─────────────────────────────────────────────
// A small red dot that appears at the press point for ~800ms so the user
// can see exactly where the script is tapping on screen.
var _clickDot = null;

function _showTap(x, y) {
  if (!_clickDot) {
    _clickDot = floaty.rawWindow(
      <frame bg="#FF4444" w="18dp" h="18dp" />
    );
    _clickDot.setTouchable(false);
  }
  // Center the dot on (x, y). setPosition uses display-area coords (below status bar),
  // while press() uses absolute screen coords — subtract status bar height to align.
  var halfPx = Math.round(9 * device.density);
  var sbH = device.statusBarHeight || 0;
  _clickDot.setPosition(x - halfPx, y - halfPx - sbH);
  if (_clickDot._hideTimer) clearTimeout(_clickDot._hideTimer);
  _clickDot._hideTimer = setTimeout(function() {
    _clickDot.setPosition(-999, -999);
  }, 800);
}

/**
 * List image files in a directory.
 * @param {string} dir - Directory path.
 * @returns {string[]} Array of image filenames, or empty array on error.
 */
function _listImages(dir) {
  try {
    var entries = files.listDir(dir, function(name) {
      if (typeof name !== "string") return false;
      var lower = name.toLowerCase();
      return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
    });
    return entries || [];
  } catch (e) {
    console.warn("_listImages: cannot list '" + dir + "': " + e);
    return [];
  }
}

/**
 * Read an image file and return a template descriptor.
 * @param {string} dir - Directory path.
 * @param {string} fileName - Image filename.
 * @returns {{name: string, image: Image, w: number, h: number}|null}
 */
function _readImage(dir, fileName) {
  var filePath = files.join(dir, fileName);
  try {
    var img = images.read(filePath);
    if (!img) return null;
    var w = img.getWidth();
    var h = img.getHeight();
    if (w > 0 && h > 0) {
      return { name: fileName, image: img, w: w, h: h };
    } else {
      img.recycle();
      return null;
    }
  } catch (e) {
    console.warn("_readImage: error reading '" + filePath + "': " + e);
    return null;
  }
}

/**
 * Load navigation templates from ./templates/navigation/ subdirectory
 * and common templates from ./templates/common/ subdirectory.
 *
 * @param {string} templateDir - Base template directory (e.g. "./templates").
 * @returns {{name: string, image: Image, w: number, h: number}[]}
 */
function loadNavigationTemplates(templateDir) {
  var templates = [];

  // Load from navigation/ subdirectory
  var navDir = files.join(templateDir, "navigation");
  var navEntries = _listImages(navDir);
  for (var i = 0; i < navEntries.length; i++) {
    var tpl = _readImage(navDir, navEntries[i]);
    if (tpl) templates.push(tpl);
  }

  // Also load from common/ subdirectory (dismiss buttons, confirm, etc.)
  var commonDir = files.join(templateDir, "common");
  var commonEntries = _listImages(commonDir);
  for (var i = 0; i < commonEntries.length; i++) {
    var tpl = _readImage(commonDir, commonEntries[i]);
    if (tpl) templates.push(tpl);
  }

  console.info("loadNavigationTemplates: loaded " + templates.length + " template(s) (nav:" + navEntries.length + " + common:" + commonEntries.length + ")");
  return templates;
}

/**
 * Pre-navigation phase: check for and dismiss the post-launch Pikmin icon
 * that sometimes appears after the game opens.
 *
 * Scans for pikmin icon1.jpg / pikmin icon2.jpg for up to 10 seconds.
 * If found → taps it, logs to panel, and returns true.
 * If timeout expires with no match → returns false (navigation continues
 * regardless).
 *
 * @param {{name: string, image: Image, w: number, h: number}[]} navTemplates
 *   Navigation templates (pikmin icon files are identified by filename).
 * @param {Object} floatyW - Floaty window for panel logging.
 * @returns {boolean} true if a pikmin icon was found and tapped.
 */
function dismissPikminIcon(navTemplates, floatyW) {
  // Locate pikmin icon templates by filename
  var pikminIcon1Tpl = null;
  var pikminIcon2Tpl = null;
  for (var i = 0; i < navTemplates.length; i++) {
    var name = navTemplates[i].name.toLowerCase();
    if (name.indexOf("pikmin icon1") !== -1 || name.indexOf("pikmin_icon1") !== -1) pikminIcon1Tpl = navTemplates[i];
    else if (name.indexOf("pikmin icon2") !== -1 || name.indexOf("pikmin_icon2") !== -1) pikminIcon2Tpl = navTemplates[i];
  }
  if (!pikminIcon1Tpl && !pikminIcon2Tpl) {
    console.info("dismissPikminIcon: no pikmin icon templates found, skipping");
    return false;
  }
  console.info("dismissPikminIcon: pikmin_icon1=" + (pikminIcon1Tpl ? "yes" : "no") +
    ", pikmin_icon2=" + (pikminIcon2Tpl ? "yes" : "no"));
  floatyMod.appendLog(floatyW, "Pikmin icon detection active (10s)");

  var timeout = 10000;
  var start = new Date().getTime();

  while (new Date().getTime() - start < timeout) {
    var img = null;
    try {
      try {
        img = captureScreen();
      } catch (e) {
        img = null;
      }
      if (!img) {
        sleep(500);
        continue;
      }

      // Check icon1 first, then icon2
      // Threshold 0.5 is used because home-screen app icons are small
      // (~125×125px) and their appearance can vary between launchers,
      // icon packs, and adaptive-icon shapes.  If you still get false
      // negatives, recapture the template or lower this further.
      var match = null;
      if (pikminIcon1Tpl) {
        match = _matchOne(img, pikminIcon1Tpl, 0.5);
      }
      if (!match && pikminIcon2Tpl) {
        match = _matchOne(img, pikminIcon2Tpl, 0.5);
      }

      if (match) {
        var tapX = match.x + Math.round(match.w / 2);
        var tapY = match.y + Math.round(match.h / 2);
        var iconName = match.name || "pikmin icon";
        console.info("dismissPikminIcon: \"" + iconName + "\" detected at (" + tapX + "," + tapY + ") — tapping");
        floatyMod.appendLog(floatyW, "Pikmin icon \"" + iconName + "\" detected! Clicking at (" + tapX + "," + tapY + ")");
        _showTap(tapX, tapY);
        press(tapX, tapY, 1000);
        sleep(1500);
        return true;
      }
    } finally {
      if (img) {
        img.recycle();
      }
    }
    sleep(500);
  }

  console.info("dismissPikminIcon: no pikmin icon detected within 10s, continuing");
  floatyMod.appendLog(floatyW, "No pikmin icon found, continuing");
  return false;
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
    console.info("_matchOne: searching for \"" + tpl.name + "\" (tpl " + tpl.w + "x" + tpl.h +
      ", threshold=" + (threshold || 0.8) + ")");
    var result = images.findImage(screenImage, tpl.image, {
      threshold: threshold || 0.8,
      region: [0, 0, screenImage.getWidth(), screenImage.getHeight()]
    });
    if (result) {
      var confidence = result.confidence !== undefined ? result.confidence : threshold;
      console.info("_matchOne: found \"" + tpl.name + "\" at (" + result.x + "," + result.y +
        ") confidence=" + confidence);
      return {
        x: result.x,
        y: result.y,
        w: tpl.w,
        h: tpl.h,
        name: tpl.name,
        confidence: confidence
      };
    } else {
      console.info("_matchOne: no match for \"" + tpl.name + "\" — below threshold");
    }
  } catch (e) {
    console.warn("_matchOne: error matching \"" + tpl.name + "\": " + e +
      (e.stack ? "\n" + e.stack : ""));
  }
  return null;
}

/**
 * Navigate through game screens until the main map is reached.
 *
 * State machine priority:
 *   1. dismiss any non-navigation-specific template (close buttons, etc.)
 *   2. go_to_map         → click to enter map
 *   3. map_view3         → already on map, navigation complete
 *   4. map_view          → click to enter map
 *   5. no match          → keep waiting, continue loop
 *
 * Returns false if the timeout is reached without reaching the map.
 *
 * @param {{name: string, image: Image, w: number, h: number}[]} navTemplates
 *   Navigation templates from loadNavigationTemplates().
 * @param {Object} config - Configuration object (uses config.app.navTimeout).
 * @param {Object} floatyW - Floaty window for panel logging.
 * @returns {boolean} true when the game map is reached, false on timeout.
 */
function navigateToMap(navTemplates, config, floatyW) {
  if (!navTemplates || navTemplates.length === 0) {
    console.warn("navigateToMap: no navigation templates — skipping navigation");
    return true;
  }

  var timeout = 120000; // 2 minute default
  if (config && config.app && config.app.navTimeout) {
    timeout = config.app.navTimeout;
  }
  var start = new Date().getTime();

  // Identify templates by filename keywords
  var goToMapTpl = null;
  var mapViewTpl = null;
  var mapView2Tpl = null;
  var mapView3Tpl = null;

  for (var i = 0; i < navTemplates.length; i++) {
    var name = navTemplates[i].name.toLowerCase();
    if (name.indexOf("go_to_map") !== -1 || name.indexOf("go to map") !== -1) {
      // Only match exact "go to map" to avoid "go to map2" overriding it
      var base = name.replace(/\.[^.]+$/, "");
      if (base === "go to map" || base === "go_to_map" || base === "gotomap") goToMapTpl = navTemplates[i];
    }
    else if (name.indexOf("map_view2") !== -1 || name.indexOf("map view2") !== -1) {
      // Skip — user only wants map_view.jpg
    }
    else if (name.indexOf("map_view3") !== -1 || name.indexOf("map view3") !== -1) {
      mapView3Tpl = navTemplates[i];
    }
    else if (name.indexOf("map_view") !== -1 || name.indexOf("map view") !== -1) mapViewTpl = navTemplates[i];
  }

  // Also handle template name without extension
  for (var i = 0; i < navTemplates.length; i++) {
    var base = navTemplates[i].name.toLowerCase().replace(/\.[^.]+$/, "");
    if (!goToMapTpl && (base === "go_to_map" || base === "go to map" || base === "gotomap")) goToMapTpl = navTemplates[i];
    if (!mapView3Tpl && (base === "map_view3" || base === "map view3" || base === "mapview3")) mapView3Tpl = navTemplates[i];
    if (!mapViewTpl && (base === "map_view" || base === "map view" || base === "mapview")) mapViewTpl = navTemplates[i];
  }

  // Build dismiss template array — any template that isn't navigation-specific
  var navKeywords = ["go_to_map", "go to map", "gotomap",
                     "map_view", "map view", "mapview",
                     "map_view2", "map view2", "mapview2",
                     "map_view3", "map view3", "mapview3",
                     "large", "own position", "own_position",
                     "pikmin icon", "pikmin_icon",
                     "advanture page", "advanture_page",
                     "store"];
  var dismissTemplates = [];
  for (var i = 0; i < navTemplates.length; i++) {
    var name = navTemplates[i].name.toLowerCase();
    var isNavSpecific = false;
    for (var k = 0; k < navKeywords.length; k++) {
      if (name.indexOf(navKeywords[k]) !== -1) {
        isNavSpecific = true;
        break;
      }
    }
    if (!isNavSpecific) {
      dismissTemplates.push(navTemplates[i]);
    }
  }

  console.info("navigateToMap: dismiss=" + dismissTemplates.length + " template(s)" +
    ", go_to_map=" + (goToMapTpl ? "yes" : "no") +
    ", map_view=" + (mapViewTpl ? "yes" : "no") +
    ", map_view2=" + (mapView2Tpl ? "yes" : "no") +
    ", map_view3=" + (mapView3Tpl ? "yes" : "no"));

  while (new Date().getTime() - start < timeout) {
    var img = null;
    try {
      try {
        img = captureScreen();
      } catch (e) {
        // captureScreen can throw if the session expired — treat as null
        img = null;
      }
      if (!img) {
        sleep(1000);
        continue;
      }

      // Priority 1: Dismiss overlays — try any common/dismiss template
      var match = null;
      for (var d = 0; d < dismissTemplates.length && !match; d++) {
        match = _matchOne(img, dismissTemplates[d], 0.7);
      }
      if (match) {
        var tapX = match.x + Math.round(match.w / 2);
        var tapY = match.y + Math.round(match.h / 2);
        console.info("navigateToMap: found dismiss button \"" + match.name + "\", pressing at (" + tapX + "," + tapY + ")");
        floatyMod.appendLog(floatyW, "Dismiss popup \"" + match.name + "\" at (" + tapX + "," + tapY + ")");
        _showTap(tapX, tapY);
        press(tapX, tapY, 1000);
        sleep(1500);
        continue;
      }

      // Priority 2: Go to map button (longer press required)
      if (goToMapTpl) {
        match = _matchOne(img, goToMapTpl, 0.7);
        if (match) {
          var tapX = match.x + Math.round(match.w / 2);
          var tapY = match.y + Math.round(match.h / 2);
          console.info("navigateToMap: found go_to_map, pressing at (" + tapX + "," + tapY + ")");
          floatyMod.appendLog(floatyW, "Tap 'Go to map' at (" + tapX + "," + tapY + ")");
          _showTap(tapX, tapY);
          press(tapX, tapY, 1000);
          console.info("navigateToMap: press() executed");
          sleep(2000);
          continue;
        }
      }

      // Priority 3: Already on map — map_view3 detected
      if (mapView3Tpl) {
        match = _matchOne(img, mapView3Tpl, 0.7);
        if (match) {
          console.info("navigateToMap: found map_view3 — already on map, navigation complete");
          floatyMod.appendLog(floatyW, "Map view3 detected — already on map!");
          return true;
        }
      }

      // Priority 4: Click map_view (the matched image itself)
      if (mapViewTpl) {
        match = _matchOne(img, mapViewTpl, 0.7);
        if (match) {
          var tapX = match.x + Math.round(match.w / 2);
          var tapY = match.y + Math.round(match.h / 2);
          console.info("navigateToMap: pressing map_view at (" + tapX + "," + tapY + ")");
          floatyMod.appendLog(floatyW, "Tap map view at (" + tapX + "," + tapY + ")");
          _showTap(tapX, tapY);
          press(tapX, tapY, 1000);
          console.info("navigateToMap: press() executed");
          sleep(2000);
          continue;
        }
      }

      // Priority 5: No template matched — keep waiting
      console.info("navigateToMap: no template matched (elapsed " +
        (new Date().getTime() - start) + "ms), continuing...");

    } finally {
      if (img) {
        img.recycle();
      }
    }

    sleep(1000);
  }

  console.warn("navigateToMap: timeout (" + timeout + "ms) — never found map_view on screen");
  floatyMod.appendLog(floatyW, "Navigation timeout — map not reached");
  return false;
}

function waitForAndClickLarge(navTemplates, floatyW, timeout) {
  timeout = timeout || 15000;
  var start = new Date().getTime();
  var largeTpl = null;
  for (var i = 0; i < navTemplates.length; i++) {
    if (navTemplates[i].name === "Large.jpg") {
      largeTpl = navTemplates[i];
      break;
    }
  }
  if (!largeTpl) {
    console.info("waitForAndClickLarge: Large.jpg not found in nav templates, skipping");
    return false;
  }
  console.info("waitForAndClickLarge: waiting for Large.jpg (timeout=" + timeout + "ms)");
  while (new Date().getTime() - start < timeout) {
    var img = null;
    try {
      img = captureScreen();
    } catch (e) {
      img = null;
    }
    if (!img) {
      sleep(500);
      continue;
    }
    try {
      var match = images.findImage(img, largeTpl.image, {
        threshold: 0.7,
        region: [0, 0, img.getWidth(), img.getHeight()]
      });
      if (match) {
        var tapX = match.x + Math.round(largeTpl.w / 2);
        var tapY = match.y + Math.round(largeTpl.h / 2);
        console.info("waitForAndClickLarge: Large.jpg found at (" + tapX + "," + tapY + ") — clicking");
        floatyMod.appendLog(floatyW, "Clicking Large at (" + tapX + "," + tapY + ")");
        _showTap(tapX, tapY);
        press(tapX, tapY, 1000);
        return true;
      }
    } finally {
      if (img) { try { img.recycle(); } catch(e) {} }
    }
    sleep(500);
  }
  console.info("waitForAndClickLarge: timeout, Large.jpg not found");
  return false;
}

function waitForAndClickOwnPosition(navTemplates, floatyW, timeout) {
  timeout = timeout || 15000;
  var start = new Date().getTime();
  var ownTpl = null;
  for (var i = 0; i < navTemplates.length; i++) {
    if (navTemplates[i].name === "Own position.jpg") {
      ownTpl = navTemplates[i];
      break;
    }
  }
  if (!ownTpl) {
    console.info("waitForAndClickOwnPosition: Own position.jpg not found in nav templates, skipping");
    return false;
  }
  console.info("waitForAndClickOwnPosition: waiting for Own position.jpg (timeout=" + timeout + "ms)");
  while (new Date().getTime() - start < timeout) {
    var img = null;
    try {
      img = captureScreen();
    } catch (e) {
      img = null;
    }
    if (!img) {
      sleep(500);
      continue;
    }
    try {
      var match = images.findImage(img, ownTpl.image, {
        threshold: 0.7,
        region: [0, 0, img.getWidth(), img.getHeight()]
      });
      if (match) {
        var tapX = match.x + Math.round(ownTpl.w / 2);
        var tapY = match.y + Math.round(ownTpl.h / 2);
        console.info("waitForAndClickOwnPosition: Own position.jpg found at (" + tapX + "," + tapY + ") — clicking");
        floatyMod.appendLog(floatyW, "Clicking Own position at (" + tapX + "," + tapY + ")");
        _showTap(tapX, tapY);
        press(tapX, tapY, 500);
        return true;
      }
    } finally {
      if (img) { try { img.recycle(); } catch(e) {} }
    }
    sleep(500);
  }
  console.info("waitForAndClickOwnPosition: timeout, Own position.jpg not found");
  return false;
}

module.exports = {
  loadNavigationTemplates: loadNavigationTemplates,
  dismissPikminIcon: dismissPikminIcon,
  navigateToMap: navigateToMap,
  waitForAndClickLarge: waitForAndClickLarge,
  waitForAndClickOwnPosition: waitForAndClickOwnPosition,
  showTap: _showTap
};
