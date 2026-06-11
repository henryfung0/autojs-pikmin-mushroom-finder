/**
 * navigator.js
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

/**
 * Load navigation templates from ./templates/navigation/ subdirectory.
 *
 * @param {string} templateDir - Base template directory (e.g. "./templates").
 * @returns {{name: string, image: Image, w: number, h: number}[]}
 */
function loadNavigationTemplates(templateDir) {
  var navDir = files.join(templateDir, "navigation");

  var entries = [];
  try {
    entries = files.listDir(navDir, function(name) {
      if (typeof name !== "string") return false;
      var lower = name.toLowerCase();
      return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
    });
  } catch (e) {
    console.warn("loadNavigationTemplates: cannot list '" + navDir + "': " + e);
    return [];
  }

  if (!entries || entries.length === 0) {
    console.warn("loadNavigationTemplates: no images found in '" + navDir + "'");
    return [];
  }

  var templates = [];
  for (var i = 0; i < entries.length; i++) {
    var fileName = entries[i];
    var filePath = files.join(navDir, fileName);
    try {
      var img = images.read(filePath);
      if (!img) continue;
      var w = img.getWidth();
      var h = img.getHeight();
      if (w > 0 && h > 0) {
        templates.push({ name: fileName, image: img, w: w, h: h });
      } else {
        img.recycle();
      }
    } catch (e) {
      console.warn("loadNavigationTemplates: error reading '" + filePath + "': " + e);
    }
  }

  console.info("loadNavigationTemplates: loaded " + templates.length + " template(s) from '" + navDir + "'");
  return templates;
}

/**
 * Try to match a single template against the screen image.
 *
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
      return {
        x: result.x,
        y: result.y,
        confidence: result.confidence !== undefined ? result.confidence : threshold
      };
    }
  } catch (e) {
    // Silently skip match errors
  }
  return null;
}

/**
 * Navigate through game screens until the main map is reached.
 *
 * State machine priority:
 *   1. close1 / close2  → click to dismiss overlays
 *   2. go_to_map         → click to enter map
 *   3. map_view          → find map_view2 and click it
 *   4. no match          → keep waiting, continue loop
 *
 * Returns false if the timeout is reached without reaching the map.
 *
 * Templates are identified by filename keywords (close1, close2,
 * go_to_map, map_view, map_view2) — the names can have any extension.
 *
 * @param {{name: string, image: Image, w: number, h: number}[]} navTemplates
 *   Navigation templates from loadNavigationTemplates().
 * @param {Object} config - Configuration object (uses config.app.navTimeout).
 * @returns {boolean} true when the game map is reached, false on timeout.
 */
function navigateToMap(navTemplates, config) {
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
  var close1Tpl = null;
  var close2Tpl = null;
  var goToMapTpl = null;
  var mapViewTpl = null;
  var mapView2Tpl = null;

  for (var i = 0; i < navTemplates.length; i++) {
    var name = navTemplates[i].name.toLowerCase();
    if (name.indexOf("close1") !== -1) close1Tpl = navTemplates[i];
    else if (name.indexOf("close2") !== -1) close2Tpl = navTemplates[i];
    else if (name.indexOf("go_to_map") !== -1 || name.indexOf("go to map") !== -1) goToMapTpl = navTemplates[i];
    else if (name.indexOf("map_view2") !== -1) mapView2Tpl = navTemplates[i];
    else if (name.indexOf("map_view") !== -1 || name.indexOf("map view") !== -1) mapViewTpl = navTemplates[i];
  }

  // Also handle template name without extension
  for (var i = 0; i < navTemplates.length; i++) {
    var base = navTemplates[i].name.toLowerCase().replace(/\.[^.]+$/, "");
    if (!close1Tpl && (base === "close1" || base === "close_1")) close1Tpl = navTemplates[i];
    if (!close2Tpl && (base === "close2" || base === "close_2")) close2Tpl = navTemplates[i];
    if (!goToMapTpl && (base === "go_to_map" || base === "go to map" || base === "gotomap")) goToMapTpl = navTemplates[i];
    if (!mapView2Tpl && (base === "map_view2" || base === "map view2" || base === "mapview2")) mapView2Tpl = navTemplates[i];
    if (!mapViewTpl && (base === "map_view" || base === "map view" || base === "mapview")) mapViewTpl = navTemplates[i];
  }

  console.info("navigateToMap: close1=" + (close1Tpl ? "yes" : "no") +
    ", close2=" + (close2Tpl ? "yes" : "no") +
    ", go_to_map=" + (goToMapTpl ? "yes" : "no") +
    ", map_view=" + (mapViewTpl ? "yes" : "no") +
    ", map_view2=" + (mapView2Tpl ? "yes" : "no"));

  while (new Date().getTime() - start < timeout) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) {
        sleep(1000);
        continue;
      }

      // Priority 1: Dismiss overlays (close buttons)
      var match = null;
      if (close1Tpl) {
        match = _matchOne(img, close1Tpl, 0.7);
      }
      if (!match && close2Tpl) {
        match = _matchOne(img, close2Tpl, 0.7);
      }
      if (match) {
        console.info("navigateToMap: found close button, tapping at (" + match.x + "," + match.y + ")");
        var tapped = click(match.x, match.y);
        if (!tapped) {
          console.warn("navigateToMap: click() returned false, trying gesture fallback");
          gesture(50, [match.x, match.y], [match.x, match.y]);
        } else {
          console.info("navigateToMap: click() succeeded");
        }
        sleep(1500);
        continue;
      }

      // Priority 2: Go to map button (longer press required)
      if (goToMapTpl) {
        match = _matchOne(img, goToMapTpl, 0.7);
        if (match) {
          console.info("navigateToMap: found go_to_map, long-pressing at (" + match.x + "," + match.y + ")");
          press(match.x, match.y, 300);
          console.info("navigateToMap: press() executed");
          sleep(2000);
          continue;
        }
      }

      // Priority 3: Map view — click map_view2
      if (mapViewTpl) {
        match = _matchOne(img, mapViewTpl, 0.7);
        if (match) {
          if (mapView2Tpl) {
            var clickTarget = _matchOne(img, mapView2Tpl, 0.7);
            if (clickTarget) {
              console.info("navigateToMap: found map_view, clicking map_view2 at (" + clickTarget.x + "," + clickTarget.y + ")");
              var tapped = click(clickTarget.x, clickTarget.y);
              if (!tapped) {
                console.warn("navigateToMap: click() returned false, trying gesture fallback");
                gesture(50, [clickTarget.x, clickTarget.y], [clickTarget.x, clickTarget.y]);
              } else {
                console.info("navigateToMap: click() succeeded");
              }
              sleep(2000);
              continue;
            }
          }
          // Fallback: click the center of the screen
          console.info("navigateToMap: found map_view but no map_view2 match, tapping center");
          var centerX = device.width / 2;
          var centerY = device.height / 2;
          var tapped = click(centerX, centerY);
          if (!tapped) {
            console.warn("navigateToMap: click() returned false, trying gesture fallback");
            gesture(50, [centerX, centerY], [centerX, centerY]);
          } else {
            console.info("navigateToMap: click() succeeded");
          }
          sleep(2000);
          continue;
        }
      }

      // Priority 4: No template matched — keep waiting
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
  return false;
}

module.exports = {
  loadNavigationTemplates: loadNavigationTemplates,
  navigateToMap: navigateToMap
};
