"auto";

var floatyMod = require("../ui/floaty");
var advConfig = require("../ui/config");

// Cached so repeated calls (e.g. every feed round) don't re-read the image.
var cachedTemplate = null;

function _getFeedingPageTemplate(templateDir) {
  if (cachedTemplate) return cachedTemplate;
  var dir = files.join(templateDir, "feeding");
  var filePath = files.join(dir, "Feeding page.jpg");
  var img = null;
  try {
    img = images.read(filePath);
    if (img && img.getWidth() > 0 && img.getHeight() > 0) {
      cachedTemplate = {
        name: "Feeding page.jpg",
        image: img,
        w: img.getWidth(),
        h: img.getHeight()
      };
      return cachedTemplate;
    }
    if (img) img.recycle();
  } catch (e) {
    console.warn("feeding_actions: error reading '" + filePath + "': " + e);
  }
  return null;
}

/**
 * Look for the single "Feeding page.jpg" template on screen until timeoutMs
 * elapses, then double-click its center (2 quick 40ms presses, 125ms gap).
 * Returns true if found and clicked, false on timeout. `label` is used only
 * for logging (e.g. "retry #2", "round re-trigger").
 */
function doubleClickFeedingPage(templateDir, timeoutMs, label, panel) {
  var tpl = _getFeedingPageTemplate(templateDir);
  if (!tpl) {
    floatyMod.appendLog(panel, "No Feeding page.jpg template found");
    return false;
  }
  var start = Date.now();
  while (Date.now() - start < timeoutMs) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) {
        sleep(500);
        continue;
      }
      var result = images.findImage(img, tpl.image, {
        threshold: 0.7,
        region: [0, 0, img.getWidth(), img.getHeight()]
      });
      if (result) {
        var tapX = result.x + Math.round(tpl.w / 2);
        var tapY = result.y + Math.round(tpl.h / 2);
        var navBarHeight =
          (advConfig.ui && advConfig.ui.navBarHeight) ||
          Math.round(device.height * 0.07);
        var maxSafeY = device.height - navBarHeight;
        if (tapY > maxSafeY) tapY = maxSafeY;
        floatyMod.appendLog(panel, "Double-click " + tpl.name + " (" + label + ")");
        floatyMod.withPanelHidden(panel, function () {
          press(tapX, tapY, 40);
          sleep(125);
          press(tapX, tapY, 40);
        });
        return true;
      }
    } finally {
      if (img) img.recycle();
    }
    sleep(500);
  }
  return false;
}

module.exports = { doubleClickFeedingPage: doubleClickFeedingPage };
