"auto";

var floatyMod = require("../ui/floaty");

function detectAndClickIcon(templateDir, account, panel) {
  var iconDir = files.join(templateDir, "icon");

  // Candidate template base names for this account. The ".1" variants are
  // the fallback images; BOTH are scanned so a match on either one works.
  var baseNames = account === 2
    ? ["pikmin icon2", "pikmin icon2.1"]
    : ["pikmin icon1", "pikmin icon1.1"];

  // Resolve actual filenames case-insensitively so detection still works
  // even if disk filenames differ in case from the base names above.
  var actualFiles = {};
  try {
    var entries = files.listDir(iconDir, function (name) {
      return (
        typeof name === "string" &&
        (name.toLowerCase().endsWith(".jpg") ||
          name.toLowerCase().endsWith(".jpeg") ||
          name.toLowerCase().endsWith(".png"))
      );
    });
    for (var e = 0; e < entries.length; e++) {
      actualFiles[entries[e].toLowerCase()] = entries[e];
    }
  } catch (err) {
    floatyMod.appendLog(panel, "Cannot list icon dir: " + err);
  }

  // Load every candidate template that actually exists on disk.
  var templates = [];
  for (var i = 0; i < baseNames.length; i++) {
    var wanted = baseNames[i].toLowerCase();
    var actual =
      actualFiles[wanted + ".jpg"] ||
      actualFiles[wanted + ".jpeg"] ||
      actualFiles[wanted + ".png"];
    if (!actual) continue;
    var filePath = files.join(iconDir, actual);
    var img = null;
    try {
      img = images.read(filePath);
      if (!img) continue;
      var w = img.getWidth();
      var h = img.getHeight();
      if (w > 0 && h > 0) {
        templates.push({ name: actual, image: img, w: w, h: h });
      } else {
        img.recycle();
      }
    } catch (e) {
      if (img) img.recycle();
      console.warn("pikmin_icon: error reading '" + filePath + "': " + e);
    }
  }

  if (templates.length === 0) {
    floatyMod.appendLog(panel, "Icon template not found for account " + account + " in " + iconDir);
    return false;
  }

  var timeout = 5000;
  var start = Date.now();
  var found = false;

  var labels = [];
  for (var l = 0; l < templates.length; l++) labels.push(templates[l].name);
  floatyMod.appendLog(panel, "Looking for " + labels.join(", ") + " (5s timeout)...");

  while (Date.now() - start < timeout) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) { sleep(500); continue; }

      // Scan ALL loaded templates on every frame — any match wins.
      for (var t = 0; t < templates.length; t++) {
        var tpl = templates[t];
        var result = images.findImage(img, tpl.image, {
          threshold: 0.75,
          region: [0, 0, img.getWidth(), img.getHeight()]
        });
        if (result) {
          var tapX = result.x + Math.round(tpl.w / 2);
          var tapY = result.y + Math.round(tpl.h / 2);
          floatyMod.appendLog(panel, tpl.name + " found at (" + tapX + "," + tapY + ") — clicking");
          press(tapX, tapY, 1000);
          found = true;
          break;
        }
      }
      if (found) break;
    } finally {
      if (img) img.recycle();
    }
    sleep(500);
  }

  for (var r = 0; r < templates.length; r++) {
    templates[r].image.recycle();
  }

  if (!found) {
    floatyMod.appendLog(panel, labels.join(", ") + " not found, assuming game already running");
  }

  return true;
}

/**
 * Launch the game package and bring it to the foreground.
 *
 * Shared by all entry points (main.js, main-headless.js, advanture/main.js)
 * so the launch + icon detection sequence lives in ONE place (DRY).
 *
 * @param {string} packageName e.g. config.app.packageName
 * @param {string} templateDir  template base directory
 * @param {number} account      account number (1 or 2) for icon selection
 * @param {object} panel        floaty panel for logging
 */
function launchAndDetectIcon(packageName, templateDir, account, panel) {
  floatyMod.appendLog(panel, "Launching " + packageName + "...");
  app.launchPackage(packageName);
  sleep(2000);

  detectAndClickIcon(templateDir, account, panel);
  sleep(2000);
}

module.exports = {
  detectAndClickIcon: detectAndClickIcon,
  launchAndDetectIcon: launchAndDetectIcon
};
