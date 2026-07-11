"auto";

var floatyMod = require("../../ui/floaty");
var advState = require("./advanture_state");
var advConfig = require("../../ui/config");

function _loadTemplatesFromDir(baseDir, subDir) {
  var dir = files.join(baseDir, subDir);
  var entries = [];
  try {
    entries = files.listDir(dir, function (name) {
      if (typeof name !== "string") return false;
      var lower = name.toLowerCase();
      return (
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg")
      );
    });
  } catch (e) {
    console.warn("collect_feeding: cannot list '" + dir + "': " + e);
    return [];
  }

  var templates = [];
  for (var i = 0; i < entries.length; i++) {
    var fileName = entries[i];
    var filePath = files.join(dir, fileName);
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
      console.warn("collect_feeding: error reading '" + filePath + "': " + e);
    }
  }
  return templates;
}

function _matchOne(screenImage, tpl, threshold) {
  if (!screenImage || !tpl || !tpl.image) return null;
  try {
    var result = images.findImage(screenImage, tpl.image, {
      threshold: threshold || 0.7,
      region: [0, 0, screenImage.getWidth(), screenImage.getHeight()],
    });
    if (result) {
      return {
        x: result.x,
        y: result.y,
        w: tpl.w,
        h: tpl.h,
        name: tpl.name,
        confidence:
          result.confidence !== undefined ? result.confidence : threshold,
      };
    }
  } catch (e) {
    console.warn('collect_feeding: error matching "' + tpl.name + '": ' + e);
  }
  return null;
}

function _tapAt(match, label, panel) {
  var tapX = match.x + Math.round(match.w / 2);
  var tapY = match.y + Math.round(match.h / 2);
  var navBarHeight =
    (advConfig.ui && advConfig.ui.navBarHeight) ||
    Math.round(device.height * 0.07);
  var maxSafeY = device.height - navBarHeight;
  if (tapY > maxSafeY) tapY = maxSafeY;
  floatyMod.appendLog(panel, label + " at (" + tapX + "," + tapY + ")");
  floatyMod.withPanelHidden(panel, function () {
    press(tapX, tapY, 1000);
  });
}

function _findFirstMatch(screenImage, templates, threshold) {
  if (!templates || templates.length === 0) return null;
  for (var i = 0; i < templates.length; i++) {
    var match = _matchOne(screenImage, templates[i], threshold);
    if (match) return match;
  }
  return null;
}

function runCollectFeeding(config, panel) {
  var templateDir =
    (config && config.detection && config.detection.templateDir) ||
    "./templates/";

  floatyMod.appendLog(panel, "Checking main page...");
  var navDir = files.join(templateDir, "navigation");
  var commonDir = files.join(templateDir, "common");
  var navTemplates = [];
  var commonTemplates = [];
  try {
    var navFiles = files.listDir(navDir, function (n) {
      return (
        typeof n === "string" &&
        (n.toLowerCase().endsWith(".jpg") || n.toLowerCase().endsWith(".png"))
      );
    });
    for (var i = 0; i < navFiles.length; i++) {
      var img = images.read(files.join(navDir, navFiles[i]));
      if (img && img.getWidth() > 0 && img.getHeight() > 0) {
        navTemplates.push({
          name: navFiles[i],
          image: img,
          w: img.getWidth(),
          h: img.getHeight(),
        });
      }
    }
  } catch (e) {}
  try {
    var commonFiles = files.listDir(commonDir, function (n) {
      return (
        typeof n === "string" &&
        (n.toLowerCase().endsWith(".jpg") || n.toLowerCase().endsWith(".png"))
      );
    });
    for (var j = 0; j < commonFiles.length; j++) {
      var cImg = images.read(files.join(commonDir, commonFiles[j]));
      if (cImg && cImg.getWidth() > 0 && cImg.getHeight() > 0) {
        commonTemplates.push({
          name: commonFiles[j],
          image: cImg,
          w: cImg.getWidth(),
          h: cImg.getHeight(),
        });
      }
    }
  } catch (e) {}
  var allNav = navTemplates.concat(commonTemplates);
  advState.isOnMainPage(allNav, {
    threshold: 0.7,
    timeout: 30000,
    floaty: panel,
    dismissTemplates: commonTemplates,
  });
  sleep(1000);

  var feedingPageTemplates = _loadTemplatesFromDir(templateDir, "feeding");
  var collectTemplates = _loadTemplatesFromDir(templateDir, "feeding/collect");

  if (feedingPageTemplates.length === 0) {
    floatyMod.appendLog(panel, "No feeding page templates found");
    return;
  }

  floatyMod.appendLog(
    panel,
    "Feeding templates: " +
      feedingPageTemplates.length +
      " page, " +
      collectTemplates.length +
      " collect items",
  );

  floatyMod.appendLog(panel, "Opening feeding page...");
  var opened = false;
  for (var attempt = 0; attempt < 5; attempt++) {
    var startTime = Date.now();
    var img = null;
    try {
      img = captureScreen();
      if (!img) {
        sleep(1000);
        continue;
      }
      var match = _findFirstMatch(img, feedingPageTemplates, 0.7);
      if (match) {
        _tapAt(match, "Tap " + match.name + " (open)", panel);
        opened = true;
        break;
      }
    } finally {
      if (img) img.recycle();
    }
    var elapsed = Date.now() - startTime;
    if (elapsed < 2000) sleep(2000 - elapsed);
  }

  if (!opened) {
    floatyMod.appendLog(panel, "Could not find feeding page button");
    return;
  }

  sleep(2000);

  var collectThreshold = 0.7;
  var collectedCount = 0;

  var maxConsecutiveMisses = 3;
  var consecutiveMisses = 0;
  var retryCount = 0;
  var maxRetries = 3;

  while (retryCount < maxRetries) {
    floatyMod.appendLog(panel, "Scanning for collect items (retry " + (retryCount + 1) + ")...");

    while (consecutiveMisses < maxConsecutiveMisses) {
      var startTime = Date.now();
      var screenImg = null;
      try {
        screenImg = captureScreen();
        if (!screenImg) {
          sleep(500);
          continue;
        }

        var collectMatch = _findFirstMatch(
          screenImg,
          collectTemplates,
          collectThreshold,
        );
        if (collectMatch) {
          collectedCount++;
          consecutiveMisses = 0;
          _tapAt(collectMatch, "Collect " + collectMatch.name, panel);
          sleep(1500);
        } else {
          consecutiveMisses++;
          if (consecutiveMisses < maxConsecutiveMisses) {
            floatyMod.appendLog(
              panel,
              "No collect item (" + consecutiveMisses + "/" + maxConsecutiveMisses + ")",
            );
          }
        }
      } finally {
        if (screenImg) screenImg.recycle();
      }
      var elapsed = Date.now() - startTime;
      if (elapsed < 1000) sleep(1000 - elapsed);
    }

    retryCount++;
    if (retryCount >= maxRetries) break;

    var doubleClickCount = (retryCount < maxRetries) ? 1 : 3;
    floatyMod.appendLog(
      panel,
      "3 consecutive misses — double click " + doubleClickCount + "x",
    );

    for (var dc = 0; dc < doubleClickCount; dc++) {
      var dcStart = Date.now();
      while (Date.now() - dcStart < 2000) {
        var dcImg = null;
        try {
          dcImg = captureScreen();
          if (!dcImg) {
            sleep(500);
            continue;
          }
          var dcMatch = _findFirstMatch(dcImg, feedingPageTemplates, 0.7);
          if (dcMatch) {
            var dcX = dcMatch.x + Math.round(dcMatch.w / 2);
            var dcY = dcMatch.y + Math.round(dcMatch.h / 2);
            var navBarH =
              (advConfig.ui && advConfig.ui.navBarHeight) ||
              Math.round(device.height * 0.07);
            var maxSafeY = device.height - navBarH;
            if (dcY > maxSafeY) dcY = maxSafeY;
            floatyMod.appendLog(
              panel,
              "Double-click " + dcMatch.name + " (retry #" + retryCount + ")",
            );
            floatyMod.withPanelHidden(panel, function () {
              press(dcX, dcY, 500);
              sleep(100);
              press(dcX, dcY, 500);
            });
            break;
          }
        } finally {
          if (dcImg) dcImg.recycle();
        }
        sleep(500);
      }
      sleep(500);
    }

    consecutiveMisses = 0;
    sleep(2000);
  }

  if (retryCount >= maxRetries) {
    floatyMod.appendLog(panel, "3 consecutive misses — double click 3x (final)");
    for (var dc = 0; dc < 3; dc++) {
      var dcStart = Date.now();
      while (Date.now() - dcStart < 2000) {
        var dcImg = null;
        try {
          dcImg = captureScreen();
          if (!dcImg) {
            sleep(500);
            continue;
          }
          var dcMatch = _findFirstMatch(dcImg, feedingPageTemplates, 0.7);
          if (dcMatch) {
            var dcX = dcMatch.x + Math.round(dcMatch.w / 2);
            var dcY = dcMatch.y + Math.round(dcMatch.h / 2);
            var navBarH =
              (advConfig.ui && advConfig.ui.navBarHeight) ||
              Math.round(device.height * 0.07);
            var maxSafeY = device.height - navBarH;
            if (dcY > maxSafeY) dcY = maxSafeY;
            floatyMod.appendLog(
              panel,
              "Double-click " + dcMatch.name + " (final #" + (dc + 1) + ")",
            );
            floatyMod.withPanelHidden(panel, function () {
              press(dcX, dcY, 500);
              sleep(100);
              press(dcX, dcY, 500);
            });
            break;
          }
        } finally {
          if (dcImg) dcImg.recycle();
        }
        sleep(500);
      }
      sleep(500);
    }
  }

  sleep(1000);

  floatyMod.appendLog(panel, "Closing feeding page (3 double-clicks)...");
  for (var clickNum = 0; clickNum < 3; clickNum++) {
    var found = false;
    var startTime = Date.now();
    while (Date.now() - startTime < 2000) {
      var closeImg = null;
      try {
        closeImg = captureScreen();
        if (!closeImg) {
          sleep(500);
          continue;
        }
        var closeMatch = _findFirstMatch(closeImg, feedingPageTemplates, 0.7);
        if (closeMatch) {
          var tapX = closeMatch.x + Math.round(closeMatch.w / 2);
          var tapY = closeMatch.y + Math.round(closeMatch.h / 2);
          var navBarHeight =
            (advConfig.ui && advConfig.ui.navBarHeight) ||
            Math.round(device.height * 0.07);
          var maxSafeY = device.height - navBarHeight;
          if (tapY > maxSafeY) tapY = maxSafeY;
          floatyMod.appendLog(
            panel,
            "Double-click " +
              closeMatch.name +
              " (close #" +
              (clickNum + 1) +
              ")",
          );
          floatyMod.withPanelHidden(panel, function () {
            press(tapX, tapY, 500);
            sleep(100);
            press(tapX, tapY, 500);
          });
          found = true;
          break;
        }
      } finally {
        if (closeImg) closeImg.recycle();
      }
      sleep(500);
    }
    if (!found) {
      floatyMod.appendLog(
        panel,
        "Feeding page button not found for click #" + (clickNum + 1),
      );
    }
    sleep(500);
  }

  sleep(1000);
  floatyMod.appendLog(panel, "Collect feeding complete");
}

module.exports = { runCollectFeeding: runCollectFeeding };
