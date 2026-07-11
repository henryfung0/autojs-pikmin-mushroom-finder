"auto";

var floatyMod = require("../ui/floaty");

function detectAndClickIcon(templateDir, account, panel) {
  var navDir = files.join(templateDir, "navigation");
  var iconName = account === 2 ? "pikmin icon2" : "pikmin icon1";
  var filePath = files.join(navDir, iconName + ".jpg");

  if (!files.exists(filePath)) {
    floatyMod.appendLog(panel, "Icon template not found: " + iconName + ".jpg");
    return false;
  }

  var iconImg = images.read(filePath);
  if (!iconImg) {
    floatyMod.appendLog(panel, "Failed to read icon template: " + iconName + ".jpg");
    return false;
  }

  var iconW = iconImg.getWidth();
  var iconH = iconImg.getHeight();
  if (iconW <= 0 || iconH <= 0) {
    iconImg.recycle();
    floatyMod.appendLog(panel, "Invalid icon template dimensions: " + iconName + ".jpg");
    return false;
  }

  var timeout = 10000;
  var start = Date.now();
  var found = false;

  floatyMod.appendLog(panel, "Looking for " + iconName + " (10s timeout)...");

  while (Date.now() - start < timeout) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); continue; }

      var result = images.findImage(img, iconImg, {
        threshold: 0.5,
        region: [0, 0, img.getWidth(), img.getHeight()]
      });

      if (result) {
        var tapX = result.x + Math.round(iconW / 2);
        var tapY = result.y + Math.round(iconH / 2);
        floatyMod.appendLog(panel, iconName + " found at (" + tapX + "," + tapY + ") — clicking");
        press(tapX, tapY, 1000);
        found = true;
        break;
      }
    } finally {
      if (img) img.recycle();
    }
    sleep(500);
  }

  iconImg.recycle();

  if (!found) {
    floatyMod.appendLog(panel, iconName + " not found within timeout");
  }

  return found;
}

module.exports = {
  detectAndClickIcon: detectAndClickIcon
};
