"auto";

var floatyMod = require("../../ui/floaty");
var advState = require("../advanture/advanture_state");
var advConfig = require("../../ui/config");
var scroll = require("../../lib/gestures");

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

function _multiTap(x, y, panel, times) {
  var navBarHeight =
    (advConfig.ui && advConfig.ui.navBarHeight) ||
    Math.round(device.height * 0.07);
  var maxSafeY = device.height - navBarHeight;
  if (y > maxSafeY) y = maxSafeY;
  floatyMod.withPanelHidden(panel, function () {
    for (var i = 0; i < times; i++) {
      press(x, y, 300);
      if (i < times - 1) {
        sleep(100);
      }
    }
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
  var reTriggerTemplates = _loadSpecificTemplates(templateDir, "feeding", ["Feeding page.jpg"]);

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
        var tapX = match.x + Math.round(match.w / 2);
        var tapY = match.y + Math.round(match.h / 2);
        var navBarHeight =
          (advConfig.ui && advConfig.ui.navBarHeight) ||
          Math.round(device.height * 0.07);
        var maxSafeY = device.height - navBarHeight;
        if (tapY > maxSafeY) tapY = maxSafeY;
        floatyMod.appendLog(panel, "Double tap " + match.name + " at (" + tapX + "," + tapY + ")");
        _multiTap(tapX, tapY, panel, 4);
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
          var tapX = retryMatch.x + Math.round(retryMatch.w / 2);
          var tapY = retryMatch.y + Math.round(retryMatch.h / 2);
          var navBarHeight =
            (advConfig.ui && advConfig.ui.navBarHeight) ||
            Math.round(device.height * 0.07);
          var maxSafeY = device.height - navBarHeight;
          if (tapY > maxSafeY) tapY = maxSafeY;
          floatyMod.appendLog(panel, "Double tap " + retryMatch.name + " (retry) at (" + tapX + "," + tapY + ")");
          _multiTap(tapX, tapY, panel, 4);
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

  // Nectar page: confirm we are on the right screen (pikmin page.jpg must be
  // visible) BEFORE clicking the fixed position (550,2012).
  var pikminPageTemplates = _loadSpecificTemplates(templateDir, "feeding/feed", ["pikmin page.jpg"]);
  if (pikminPageTemplates.length === 0) {
    floatyMod.appendLog(panel, "Warning: pikmin page.jpg template not found");
  }

  floatyMod.appendLog(panel, "Checking pikmin page before clicking nectar page...");
  var pikminPageVisible = false;
  for (var nectarWaitTry = 0; nectarWaitTry < 5; nectarWaitTry++) {
    var startTime = Date.now();
    var img = null;
    try {
      img = captureScreen();
      if (!img) {
        sleep(1000);
        continue;
      }
      var match = _findFirstMatch(img, pikminPageTemplates, 0.7);
      if (match) {
        pikminPageVisible = true;
        break;
      }
    } finally {
      if (img) img.recycle();
    }
    var elapsed = Date.now() - startTime;
    if (elapsed < 2000) sleep(2000 - elapsed);
  }

  if (!pikminPageVisible) {
    floatyMod.appendLog(panel, "Pikmin page not visible within timeout; clicking fixed position anyway");
  }

  floatyMod.appendLog(panel, "Clicking nectar page at fixed position (550,2012)...");
  var nectarPageX = 550;
  var nectarPageY = 2012;
  var navBarHeight =
    (advConfig.ui && advConfig.ui.navBarHeight) ||
    Math.round(device.height * 0.07);
  var maxSafeY = device.height - navBarHeight;
  if (nectarPageY > maxSafeY) nectarPageY = maxSafeY;
  floatyMod.withPanelHidden(panel, function () {
    press(nectarPageX, nectarPageY, 1000);
  });

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

  floatyMod.appendLog(panel, "Clicking middle of screen...");
  var midX = Math.round(device.width / 2);
  var midY = Math.round(device.height / 2);
  _multiTap(midX, midY, panel, 2);

  sleep(2000);

  var screenImg = null;
  try {
    screenImg = captureScreen();
    if (!screenImg) {
      floatyMod.appendLog(panel, "Failed to capture screen for OCR");
      return;
    }

    var flowersRegion = [0, 475, 250, 100];
    var flowersResult = ocr(screenImg, flowersRegion);
    var flowers = flowersResult ? flowersResult.join(" ").trim() : "0";
    floatyMod.appendLog(panel, "Flowers: " + flowers);

    var nectarRegion = [0, 660, 250, 100];
    var nectarResult = ocr(screenImg, nectarRegion);
    var numberNectar = nectarResult ? nectarResult.join(" ").trim() : "0";
    floatyMod.appendLog(panel, "Number Nectar: " + numberNectar);

    // Extract numbers from OCR results — strip all non-digits so that
    // "1,044" (comma in thousand separator) parses as 1044, not 1.
    var flowersNum = parseInt(flowers.replace(/[^\d]/g, ""), 10) || 0;
    var nectarNum = parseInt(numberNectar.replace(/[^\d]/g, ""), 10) || 0;

    // Calculate how many to feed
    var maxFlowers = 1200;
    var flowersNeeded = Math.floor((maxFlowers - flowersNum) / 80);
    var nectarCanFeed = Math.floor(nectarNum / 40);
    var feedCount = Math.min(flowersNeeded, nectarCanFeed);

    floatyMod.appendLog(panel, "Feed count: " + feedCount + " (flowers=" + flowersNum + ", nectar=" + nectarNum + ")");

    if (feedCount > 0) {
      var nectarTapX = 125;
      var nectarTapY = 710;
      floatyMod.appendLog(panel, "Clicking nectar at (" + nectarTapX + "," + nectarTapY + ")");
      floatyMod.withPanelHidden(panel, function() {
        press(nectarTapX, nectarTapY, 1000);
      });
      sleep(2000);

      // feedNectar: feed nectar scroll path — edit freely.
      var feedNectar = [
        [576, 2000],[358, 868],[550, 1100],[763, 868],[550, 1100],[763, 1332],[550, 1100],[358, 1332],
        [576, 2000],[358, 868],[550, 1100],[763, 868],[550, 1100],[763, 1332],[550, 1100],[358, 1332],
        [576, 2000],[358, 868],[550, 1100],[763, 868],[550, 1100],[763, 1332],[550, 1100],[358, 1332],
      ];
      // collectFlowers: collect flowers scroll path — edit freely.
      var collectFlowers = [
        [550, 1100],
        [110, 620],[1000, 620],[1000, 710],[110, 710],
        [110, 800],[1000, 800],[1000, 890],[110, 890],
        [110, 980],[1000, 980],[1000, 1070],[110, 1070],
        [110, 1160],[1000, 1160],[1000, 1250],[110, 1250],
        [110, 1340],[1000, 1340],[1000, 1430],[110, 1430],
        [110, 1520],[1000, 1520],[1000, 1610],[110, 1610],
      ];

      // can feed templates: gate whether nectar feeding is possible each round.
      var canFeedTemplates = _loadTemplatesFromDir(templateDir, "feeding/feed/can feed");
      if (canFeedTemplates.length === 0) {
        floatyMod.appendLog(panel, "Warning: no templates in feeding/feed/can feed, nectar will be skipped");
      }
      // back button used around the can-feed scan (pikminPageTemplates is
      // already loaded earlier, before the nectar page click).
      var backTemplates = _loadSpecificTemplates(templateDir, "feeding/feed", ["back.jpg"]);

      // Only a SUCCESSFUL feed round counts toward feedCount; a failed
      // (no can-feed match) attempt retries WITHOUT consuming a round.
      var completedRounds = 0;
      var maxAttempts = feedCount * 3;
      var attempt = 0;
      var consecutiveFailures = 0;
      var stoppedEarly = false;
      while (completedRounds < feedCount && attempt < maxAttempts) {
        attempt++;
        floatyMod.appendLog(panel, "Feed round " + (completedRounds + 1) + "/" + feedCount);

        // 1. Open the pikmin page so the can-feed state is visible (timeout ~10s).
        floatyMod.appendLog(panel, "Opening pikmin page...");
        var pikminOpened = false;
        for (var pikminTry = 0; pikminTry < 5; pikminTry++) {
          var startTime = Date.now();
          var pikminImg = null;
          try {
            pikminImg = captureScreen();
            if (!pikminImg) {
              sleep(1000);
              continue;
            }
            var pikminMatch = _findFirstMatch(pikminImg, pikminPageTemplates, 0.7);
            if (pikminMatch) {
              _tapAt(pikminMatch, "Tap " + pikminMatch.name + " (pikmin page)", panel);
              pikminOpened = true;
              break;
            }
          } finally {
            if (pikminImg) pikminImg.recycle();
          }
          var elapsed = Date.now() - startTime;
          if (elapsed < 2000) sleep(2000 - elapsed);
        }
        if (!pikminOpened) {
          floatyMod.appendLog(panel, "Pikmin page template not found within timeout");
        }

        // 1b. Wait until the pikmin page has opened: back.jpg must be visible.
        floatyMod.appendLog(panel, "Waiting for back button...");
        var backVisible = false;
        for (var waitTry = 0; waitTry < 5; waitTry++) {
          var startTime = Date.now();
          var waitImg = null;
          try {
            waitImg = captureScreen();
            if (!waitImg) {
              sleep(1000);
              continue;
            }
            var waitMatch = _findFirstMatch(waitImg, backTemplates, 0.7);
            if (waitMatch) {
              backVisible = true;
              break;
            }
          } finally {
            if (waitImg) waitImg.recycle();
          }
          var elapsed = Date.now() - startTime;
          if (elapsed < 2000) sleep(2000 - elapsed);
        }
        if (!backVisible) {
          floatyMod.appendLog(panel, "Back button not visible within timeout");
        }
        sleep(500);

        // 2. Scan can-feed templates (up to 3 attempts, raised threshold
        //    0.8 for stricter matching to avoid false positives) BEFORE any zoom.
        var canFeed = false;
        for (var scan = 0; scan < 3; scan++) {
          var canFeedImg = null;
          var canFeedMatch = null;
          try {
            canFeedImg = captureScreen();
            if (canFeedImg) {
              canFeedMatch = _findFirstMatch(canFeedImg, canFeedTemplates, 0.8);
            }
          } finally {
            if (canFeedImg) canFeedImg.recycle();
          }
          if (canFeedMatch) {
            floatyMod.appendLog(panel, "Can feed detected (" + canFeedMatch.name + ") on scan " + (scan + 1) + "/3");
            canFeed = true;
            break;
          }
          floatyMod.appendLog(panel, "No can-feed match on scan " + (scan + 1) + "/3, rescanning...");
          sleep(500);
        }

        // 3. Click back regardless of the scan result (timeout ~10s).
        floatyMod.appendLog(panel, "Clicking back...");
        var backClicked = false;
        for (var backTry = 0; backTry < 5; backTry++) {
          var startTime = Date.now();
          var backImg = null;
          try {
            backImg = captureScreen();
            if (!backImg) {
              sleep(1000);
              continue;
            }
            var backMatch = _findFirstMatch(backImg, backTemplates, 0.7);
            if (backMatch) {
              _tapAt(backMatch, "Tap " + backMatch.name + " (back)", panel);
              backClicked = true;
              break;
            }
          } finally {
            if (backImg) backImg.recycle();
          }
          var elapsed = Date.now() - startTime;
          if (elapsed < 2000) sleep(2000 - elapsed);
        }
        if (!backClicked) {
          floatyMod.appendLog(panel, "Back template not found within timeout");
        }

        // 3b. Wait until we are back on the base screen: pikmin page.jpg must be visible again.
        floatyMod.appendLog(panel, "Waiting for pikmin page...");
        var pikminBackVisible = false;
        for (var waitBackTry = 0; waitBackTry < 5; waitBackTry++) {
          var startTime = Date.now();
          var waitBackImg = null;
          try {
            waitBackImg = captureScreen();
            if (!waitBackImg) {
              sleep(1000);
              continue;
            }
            var waitBackMatch = _findFirstMatch(waitBackImg, pikminPageTemplates, 0.7);
            if (waitBackMatch) {
              pikminBackVisible = true;
              break;
            }
          } finally {
            if (waitBackImg) waitBackImg.recycle();
          }
          var elapsed = Date.now() - startTime;
          if (elapsed < 2000) sleep(2000 - elapsed);
        }
        if (!pikminBackVisible) {
          floatyMod.appendLog(panel, "Pikmin page not visible within timeout");
        }
        sleep(500);

        // 4. Only when can-feed was detected: zoom out → feed nectar → collect flowers.
        if (canFeed) {
          scroll.zoom("out", 1, panel);
          sleep(500);

          floatyMod.appendLog(panel, "Feeding nectar...");
          try {
            gestures([10000].concat(feedNectar));
          } catch (e) {
            floatyMod.appendLog(panel, "Feed nectar gesture failed: " + e);
          }
          sleep(500);
          floatyMod.appendLog(panel, "Collecting flowers...");
          try {
            gestures([3000].concat(collectFlowers));
          } catch (e) {
            floatyMod.appendLog(panel, "Collect flowers gesture failed: " + e);
          }
          floatyMod.appendLog(panel, "Collecting flowers (mirrored)...");
          try {
            // mirror x-axis (110 ↔ 1000) so sweep direction reverses,
            // same y-progression so the scroll continues downward, no backtrack
            var collectFlowersMirrored = collectFlowers.map(function (p) {
              return [1110 - p[0], p[1]];
            });
            gestures([3000].concat(collectFlowersMirrored));
          } catch (e) {
            floatyMod.appendLog(panel, "Collect flowers mirrored gesture failed: " + e);
          }
          sleep(1000);
          completedRounds++;
          consecutiveFailures = 0;
        } else {
          // Cannot feed: skip zoom/feed/collect. This attempt does NOT
          // count toward feedCount — re-trigger and retry.
          consecutiveFailures++;
          floatyMod.appendLog(panel, "Cannot feed now (no can-feed match after 3 scans), retrying without counting round (" + consecutiveFailures + " consecutive)");
          sleep(1000);
        }

        // Abort after 3 CONSECUTIVE cannot-feed attempts: end the feeding
        // logic (housekeeping back to main page happens after the loop).
        if (consecutiveFailures >= 3) {
          floatyMod.appendLog(panel, "3 consecutive cannot-feed attempts, ending feeding logic");
          stoppedEarly = true;
          break;
        }

        if (completedRounds < feedCount) {
          floatyMod.appendLog(panel, "Re-triggering feeding page...");
          var reImg = null;
          try {
            reImg = captureScreen();
            var reMatch = reImg ? _findFirstMatch(reImg, reTriggerTemplates, 0.7) : null;
            if (reMatch) {
              var rx = reMatch.x + Math.round(reMatch.w / 2);
              var ry = reMatch.y + Math.round(reMatch.h / 2);
              floatyMod.appendLog(panel, "Double-click " + reMatch.name + " (round re-trigger)");
              floatyMod.withPanelHidden(panel, function () {
                press(rx, ry, 40);
                sleep(125);
                press(rx, ry, 40);
              });
              sleep(2000);
            } else {
              floatyMod.appendLog(panel, "Feeding page not found for next round");
            }
          } finally {
            if (reImg) reImg.recycle();
          }
        }
      }

      if (completedRounds < feedCount) {
        floatyMod.appendLog(panel, "Stopped after " + attempt + " attempts (" + completedRounds + "/" + feedCount + " rounds completed)");
      }

      // Housekeeping: if the feeding logic was aborted early (3 consecutive
      // cannot-feed attempts), return to the main page via the common helper.
      if (stoppedEarly) {
        floatyMod.appendLog(panel, "Housekeeping: returning to main page...");
        _navigateToMainPage(templateDir, panel);
      }
    }

    console.log("=== Feed Pikmin Results ===");
    console.log("Flowers: " + flowers);
    console.log("Number Nectar: " + numberNectar);
    console.log("Feed count: " + feedCount);
    console.log("===========================");
  } finally {
    if (screenImg) screenImg.recycle();
  }
}

module.exports = { feedPikmin: feedPikmin };
