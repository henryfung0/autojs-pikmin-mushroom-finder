"auto";

var floatyMod = require("../ui/floaty");

function detectAndClickIcon(templateDir, account, panel) {
  var iconDir = files.join(templateDir, "icon");
  var iconName = account === 2 ? "pikmin icon2" : "pikmin icon1";
  var iconFallback = iconName + ".1";

  var iconImg = null;
  var iconW = 0;
  var iconH = 0;
  var iconLabel = iconName;

  var filePath = files.join(iconDir, iconName + ".jpg");
  if (files.exists(filePath)) {
    iconImg = images.read(filePath);
  }

  var fallbackImg = null;
  var fallbackW = 0;
  var fallbackH = 0;
  var fallbackPath = files.join(iconDir, iconFallback + ".jpg");
  if (files.exists(fallbackPath)) {
    fallbackImg = images.read(fallbackPath);
    if (fallbackImg) {
      fallbackW = fallbackImg.getWidth();
      fallbackH = fallbackImg.getHeight();
    }
  }

  if (!iconImg && !fallbackImg) {
    floatyMod.appendLog(panel, "Icon template not found: " + iconName + ".jpg or " + iconFallback + ".jpg");
    return false;
  }

  if (iconImg) {
    iconW = iconImg.getWidth();
    iconH = iconImg.getHeight();
    if (iconW <= 0 || iconH <= 0) {
      iconImg.recycle();
      iconImg = null;
      iconW = 0;
      iconH = 0;
    }
  }

  if (!iconImg && fallbackImg) {
    iconImg = fallbackImg;
    iconW = fallbackW;
    iconH = fallbackH;
    iconLabel = iconFallback;
    fallbackImg = null;
    fallbackW = 0;
    fallbackH = 0;
  }

  if (!iconImg) {
    floatyMod.appendLog(panel, "Invalid icon template dimensions");
    return false;
  }

  var timeout = 10000;
  var start = Date.now();
  var found = false;

  floatyMod.appendLog(panel, "Looking for " + iconLabel + " (10s timeout)...");

  while (Date.now() - start < timeout) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); continue; }

      var result = images.findImage(img, iconImg, {
        threshold: 0.75,
        region: [0, 0, img.getWidth(), img.getHeight()]
      });

      if (result) {
        var tapX = result.x + Math.round(iconW / 2);
        var tapY = result.y + Math.round(iconH / 2);
        floatyMod.appendLog(panel, iconLabel + " found at (" + tapX + "," + tapY + ") — clicking");
        press(tapX, tapY, 1000);
        found = true;
        break;
      } else if (fallbackImg) {
        var result2 = images.findImage(img, fallbackImg, {
          threshold: 0.75,
          region: [0, 0, img.getWidth(), img.getHeight()]
        });
        if (result2) {
          var tapX = result2.x + Math.round(fallbackW / 2);
          var tapY = result2.y + Math.round(fallbackH / 2);
          floatyMod.appendLog(panel, iconFallback + " found at (" + tapX + "," + tapY + ") — clicking");
          press(tapX, tapY, 1000);
          found = true;
          break;
        }
      }
    } finally {
      if (img) img.recycle();
    }
    sleep(500);
  }

  if (iconImg) iconImg.recycle();
  if (fallbackImg) fallbackImg.recycle();

  if (!found) {
    floatyMod.appendLog(panel, iconLabel + " not found within timeout");
  }

  return found;
}

module.exports = {
  detectAndClickIcon: detectAndClickIcon
};
