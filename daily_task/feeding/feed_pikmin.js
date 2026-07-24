"auto";

var floatyMod = require("../../ui/floaty");
var advState = require("../advanture/advanture_state");
var advConfig = require("../../ui/config");

var searchKeywords = ["白色"];

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
    console.warn("feed_pikmin: cannot list '" + dir + "': " + e);
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
      console.warn("feed_pikmin: error reading '" + filePath + "': " + e);
    }
  }
  return templates;
}

function _loadSpecificTemplates(baseDir, subDir, fileNames) {
  var dir = files.join(baseDir, subDir);
  var templates = [];
  for (var i = 0; i < fileNames.length; i++) {
    var filePath = files.join(dir, fileNames[i]);
    try {
      var img = images.read(filePath);
      if (!img) continue;
      var w = img.getWidth();
      var h = img.getHeight();
      if (w > 0 && h > 0) {
        templates.push({ name: fileNames[i], image: img, w: w, h: h });
      } else {
        img.recycle();
      }
    } catch (e) {
      console.warn("feed_pikmin: error reading '" + filePath + "': " + e);
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
    console.warn('feed_pikmin: error matching "' + tpl.name + '": ' + e);
  }
  return null;
}

function _findFirstMatch(screenImage, templates, threshold) {
  if (!templates || templates.length === 0) return null;
  for (var i = 0; i < templates.length; i++) {
    var match = _matchOne(screenImage, templates[i], threshold);
    if (match) return match;
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

function _doubleTap(x, y, panel) {
  var navBarHeight =
    (advConfig.ui && advConfig.ui.navBarHeight) ||
    Math.round(device.height * 0.07);
  var maxSafeY = device.height - navBarHeight;
  if (y > maxSafeY) y = maxSafeY;
  floatyMod.withPanelHidden(panel, function () {
    press(x, y, 500);
    sleep(100);
    press(x, y, 500);
  });
}

function _navigateToMainPage(templateDir, panel) {
  floatyMod.appendLog(panel, "Navigating to main page...");
  var navDir = files.join(templateDir, "navigation");
  var commonDir = files.join(templateDir, "common");
  var navTemplates = _loadTemplatesFromDir(templateDir, "navigation");
  var commonTemplates = _loadTemplatesFromDir(templateDir, "common");
  var allNav = navTemplates.concat(commonTemplates);

  advState.isOnMainPage(allNav, {
    threshold: 0.7,
    timeout: 30000,
    floaty: panel,
    dismissTemplates: commonTemplates,
  });
  sleep(1000);
}

function feedPikmin(config, panel) {
  var templateDir =
    (config && config.detection && config.detection.templateDir) ||
    "./templates/";

  _navigateToMainPage(templateDir, panel);

  var feedingPageTemplates = _loadTemplatesFromDir(templateDir, "feeding");

  if (feedingPageTemplates.length === 0) {
    floatyMod.appendLog(panel, "No feeding page templates found");
    return;
  }

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
    floatyMod.appendLog(panel, "Could not find feeding page, navigating to main and retrying...");
    _navigateToMainPage(templateDir, panel);
    for (var retry = 0; retry < 3; retry++) {
      var retryImg = null;
      try {
        retryImg = captureScreen();
        if (!retryImg) { sleep(1000); continue; }
        var retryMatch = _findFirstMatch(retryImg, feedingPageTemplates, 0.7);
        if (retryMatch) {
          _tapAt(retryMatch, "Tap " + retryMatch.name + " (open retry)", panel);
          opened = true;
          break;
        }
      } finally {
        if (retryImg) retryImg.recycle();
      }
      sleep(2000);
    }
  }

  if (!opened) {
    floatyMod.appendLog(panel, "Could not find feeding page after retries");
    return;
  }

  sleep(2000);

  var nectarPageTemplates = _loadSpecificTemplates(templateDir, "feeding/feed", ["Nector page.jpg"]);
  if (nectarPageTemplates.length === 0) {
    floatyMod.appendLog(panel, "No nectar page templates found");
    return;
  }

  floatyMod.appendLog(panel, "Looking for nectar page...");
  var nectarFound = false;
  for (var attempt = 0; attempt < 5; attempt++) {
    var startTime = Date.now();
    var img = null;
    try {
      img = captureScreen();
      if (!img) {
        sleep(1000);
        continue;
      }
      var match = _findFirstMatch(img, nectarPageTemplates, 0.6);
      if (match) {
        _tapAt(match, "Tap " + match.name + " (nectar)", panel);
        nectarFound = true;
        break;
      }
    } finally {
      if (img) img.recycle();
    }
    var elapsed = Date.now() - startTime;
    if (elapsed < 2000) sleep(2000 - elapsed);
  }

  if (!nectarFound) {
    floatyMod.appendLog(panel, "Could not find nectar page");
    return;
  }

  sleep(2000);

  var searchTemplates = _loadSpecificTemplates(templateDir, "feeding/feed", ["search.jpg"]);
  if (searchTemplates.length === 0) {
    floatyMod.appendLog(panel, "No search templates found");
    return;
  }

  floatyMod.appendLog(panel, "Looking for search button...");
  var searchFound = false;
  for (var attempt = 0; attempt < 5; attempt++) {
    var startTime = Date.now();
    var img = null;
    try {
      img = captureScreen();
      if (!img) {
        sleep(1000);
        continue;
      }
      var match = _findFirstMatch(img, searchTemplates, 0.7);
      if (match) {
        _tapAt(match, "Tap " + match.name + " (search)", panel);
        searchFound = true;
        break;
      }
    } finally {
      if (img) img.recycle();
    }
    var elapsed = Date.now() - startTime;
    if (elapsed < 2000) sleep(2000 - elapsed);
  }

  if (!searchFound) {
    floatyMod.appendLog(panel, "Could not find search button");
    return;
  }

  sleep(1000);

  for (var k = 0; k < searchKeywords.length; k++) {
    var keyword = searchKeywords[k];
    floatyMod.appendLog(panel, "Typing: " + keyword);
    var inputField = text("Search").findOne(3000) || text("搜索").findOne(3000);
    if (inputField) {
      inputField.click();
      sleep(300);
      input(keyword);
      sleep(500);
    } else {
      floatyMod.appendLog(panel, "Search field not found!");
    }
  }

  sleep(1000);

  floatyMod.appendLog(panel, "Clicking middle of screen...");
  var midX = Math.round(device.width / 2);
  var midY = Math.round(device.height / 2);
  _doubleTap(midX, midY, panel);

  sleep(2000);

  var screenImg = null;
  try {
    screenImg = captureScreen();
    if (!screenImg) {
      floatyMod.appendLog(panel, "Failed to capture screen for OCR");
      return;
    }

    var flowersRegion = [0, 475, 250, 575];
    var flowersResult = ocr(screenImg, flowersRegion);
    var flowers = flowersResult ? flowersResult.join(" ").trim() : "0";
    floatyMod.appendLog(panel, "Flowers: " + flowers);

    var nectarRegion = [0, 660, 250, 800];
    var nectarResult = ocr(screenImg, nectarRegion);
    var numberNectar = nectarResult ? nectarResult.join(" ").trim() : "0";
    floatyMod.appendLog(panel, "Number Nectar: " + numberNectar);

    console.log("=== Feed Pikmin Results ===");
    console.log("Flowers: " + flowers);
    console.log("Number Nectar: " + numberNectar);
    console.log("===========================");
  } finally {
    if (screenImg) screenImg.recycle();
  }
}

module.exports = { feedPikmin: feedPikmin };
