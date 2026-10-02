"auto";

var floatyMod = require("../../ui/floaty");
var advState = require("../advanture/advanture_state");
var advConfig = require("../../ui/config");
var scroll = require("../../lib/gestures");
var feedingActions = require("../../lib/feeding_actions");
var collectFeedingMod = require("../advanture/collect_feeding");
var matcher = require("../../lib/matcher");

// Search keywords: the search filter is re-typed for each keyword, and the
// full color rotation (white → yellow → red → blue) runs for every keyword.
var _baseKeywords = [
  "",
  "洋桔梗", "扶桑花", "風鈴草", "美人蕉", "九重葛", "海芋", "山茶花", "油菜花", "康乃馨", "雞冠花", "櫻花", "鐵線蓮", "彼岸花", "鈴蘭", "大波斯菊", "兔耳花",
  "銀蓮花", "菊花", "大理花", "石竹", "曇花", "勿忘草", "小蒼蘭",
  "龍膽", "聖誕玫瑰", "風信子", "繡球花", "鳶尾花", "牽牛花", "蝴蝶蘭", "粉蝶花",
  "睡蓮", "三色堇", "牡丹", "矮牽牛", "聖誕紅", "櫻草花", "玫瑰", "週年紀念玫瑰",
  "鼠尾草", "金魚草", "豌豆花", "鬱金香", "鸚鵡鬱金香"
];

// Working list: base catalog + OCR-discovered extras persisted in the
// pikmin_config store. New words found by OCR_flower_name are inserted right
// after the empty string and saved back, so they survive script restarts.
var searchKeywords = _baseKeywords.slice();

// True until the first OCR discovery is persisted — the very first run logs
// the whole list once so the user can verify what will be searched.
var _isFirstRun = false;

function _loadExtraKeywords() {
  try {
    var store = storages.create("pikmin_config");
    // Missing key = first run (nothing learned yet); show the full list once.
    var existing = store.get("searchKeywordsExtra", null);
    _isFirstRun = existing === null;
    var extra = existing === null ? [] : existing;
    if (!Array.isArray(extra)) return;
    // Reverse insertion at index 1 reproduces the persisted list order
    // (newest discovery first, matching how new words are added at runtime).
    for (var i = extra.length - 1; i >= 0; i--) {
      var w = String(extra[i]).trim();
      if (w && searchKeywords.indexOf(w) === -1) {
        searchKeywords.splice(1, 0, w);
      }
    }
  } catch (e) {
    console.warn("feed_pikmin: cannot load extra keywords: " + e);
  }
}

function _saveExtraKeywords() {
  try {
    var store = storages.create("pikmin_config");
    var extras = searchKeywords.filter(function (w) {
      return w !== "" && _baseKeywords.indexOf(w) === -1;
    });
    store.put("searchKeywordsExtra", extras);
    _isFirstRun = false;
  } catch (e) {
    console.warn("feed_pikmin: cannot save extra keywords: " + e);
  }
}

// _loadExtraKeywords(); // DISABLED: persisted OCR garbage was bleeding into the search list

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

  sleep(5000);

  var navTemplates = _loadTemplatesFromDir(templateDir, "navigation");
  var commonTemplates = matcher.loadAllTemplates(files.join(templateDir, "common"), { excludeDirs: [] });
  var allNav = navTemplates.concat(commonTemplates);

  var onMain = advState.isOnMainPage(allNav, {
    threshold: 0.6,
    timeout: 30000,
    floaty: panel,
    dismissTemplates: commonTemplates,
  });
  if (!onMain) {
    floatyMod.appendLog(panel, "isOnMainPage timed out — retrying once...");
    sleep(5000);
    onMain = advState.isOnMainPage(allNav, {
      threshold: 0.6,
      timeout: 30000,
      floaty: panel,
      dismissTemplates: commonTemplates,
    });
    if (!onMain) {
      floatyMod.appendLog(panel, "isOnMainPage failed twice — cannot reach main page, exiting feed pikmin");
      return;
    }
  }
  sleep(1000);
}

function _paddleOcr(img) {
  var result;
  if (typeof ocr !== "undefined" && typeof ocr.paddle !== "undefined") {
    try {
      result = ocr.paddle.recognizeText(img);
    } catch (e) {
      // Plugin APK installed but not enabled in AutoJS6 plugin management,
      // or models not yet loaded — fall back to built-in MLKit OCR.
      result = ocr(img);
    }
  } else {
    result = ocr(img);
  }
  // Normalize: paddle may return {text, confidence, rect}[] or string[];
  // built-in ocr() returns string[].  We always want string[].
  if (!result) return [];
  if (typeof result[0] === "object" && result[0].text !== undefined) {
    return result.map(function (r) {
      return r.text;
    });
  }
  return result;
}

// Single-shot OCR for a fixed region. Returns {num, success}. Failure =
// empty OCR text (no digits found) — anything else, including a parsed 0
// or a value matching maxFlowers, is accepted as a real value.
function _tryOcrRegion(label, x, y, w, h, screenImg, panel) {
  var cropped = null;
  var rawResult = null;
  try {
    cropped = images.clip(screenImg, x, y, w, h);
    rawResult = _paddleOcr(cropped);
  } finally {
    if (cropped) cropped.recycle();
  }

  var rawText = rawResult ? rawResult.join(" ").trim() : "";
  var digitsOnly = rawText.replace(/[^\d]/g, "");

  if (digitsOnly === "") {
    return { num: 0, success: false };
  }

  var num = parseInt(digitsOnly, 10);
  floatyMod.appendLog(panel, label + " OCR found " + num + " at y=" + y);
  return { num: num, success: true };
}

// Coordinated retry + Y-bump for the flowers and nectar regions. At each
// Y, retries each region up to 3 times with a 1s wait between attempts.
// Y is bumped by +100 ONLY when both regions fail to read — if one
// succeeds, the other is accepted as-is (falling back to maxFlowers/0
// respectively) without bumping, since a partially-successful OCR pass
// indicates the regions are correctly aligned for at least one value.
// Up to 4 Y bumps (offsets 0, +100, +200, +300, +400).
function _ocrFlowersAndNectarWithBump(
  flowersX, flowersYBase, flowersW, flowersH,
  nectarX, nectarYBase, nectarW, nectarH,
  screenImg, panel, maxFlowers
) {
  var MAX_Y_BUMPS = 4;
  var RETRIES_PER_Y = 3;
  var RETRY_WAIT_MS = 1000;

  for (var bump = 0; bump <= MAX_Y_BUMPS; bump++) {
    var yOffset = bump * 100;
    var flowersY = flowersYBase + yOffset;
    var nectarY = nectarYBase + yOffset;

    var flowersResult = { num: 0, success: false };
    for (var fr = 0; fr < RETRIES_PER_Y; fr++) {
      if (fr > 0) sleep(RETRY_WAIT_MS);
      flowersResult = _tryOcrRegion("Flowers", flowersX, flowersY, flowersW, flowersH, screenImg, panel);
      if (flowersResult.success) break;
    }

    var nectarResult = { num: 0, success: false };
    for (var nr = 0; nr < RETRIES_PER_Y; nr++) {
      if (nr > 0) sleep(RETRY_WAIT_MS);
      nectarResult = _tryOcrRegion("Number Nectar", nectarX, nectarY, nectarW, nectarH, screenImg, panel);
      if (nectarResult.success) break;
    }

    if (flowersResult.success && nectarResult.success) {
      return { flowersNum: flowersResult.num, nectarNum: nectarResult.num, yOffset: yOffset };
    }

    if (flowersResult.success || nectarResult.success) {
      floatyMod.appendLog(panel, "Partial OCR — keeping current Y (no +100 bump). flowers=" + (flowersResult.success ? flowersResult.num : "fail") + ", nectar=" + (nectarResult.success ? nectarResult.num : "fail"));
      if (!flowersResult.success) {
        floatyMod.appendLog(panel, "Flowers OCR FAILED → using fallback maxFlowers=" + maxFlowers);
      }
      if (!nectarResult.success) {
        floatyMod.appendLog(panel, "Number Nectar OCR FAILED → using fallback 0");
      }
      return {
        flowersNum: flowersResult.success ? flowersResult.num : maxFlowers,
        nectarNum: nectarResult.success ? nectarResult.num : 0,
        yOffset: yOffset,
      };
    }

    if (bump < MAX_Y_BUMPS) {
      floatyMod.appendLog(panel, "Both OCR failed at y+" + yOffset + ", +100 to y+" + (yOffset + 100));
    }
  }

  floatyMod.appendLog(panel, "OCR exhausted all Y bumps");
  floatyMod.appendLog(panel, "Flowers OCR FAILED → using fallback maxFlowers=" + maxFlowers);
  floatyMod.appendLog(panel, "Number Nectar OCR FAILED → using fallback 0");
  return { flowersNum: maxFlowers, nectarNum: 0, yOffset: MAX_Y_BUMPS * 100 };
}

/** ... */

function OCR_flower_name(panel) {
  // Recursively cut merged names: when a token is longer than 5 chars and has
  // 花/草 in the middle (not first/last), split right after it — the OCR often
  // concatenates two names ("扶桑花風鈴草" → 扶桑花 + 風鈴草).
  function _splitLongNames(word) {
    if (word.length <= 5) return [word];
    for (var i = 1; i < word.length - 1; i++) {
      var ch = word.charAt(i);
      if (ch === "花" || ch === "草") {
        return _splitLongNames(word.substring(0, i + 1))
          .concat(_splitLongNames(word.substring(i + 1)));
      }
    }
    return [word];
  }

  sleep(1000);
  var img = null;
  try {
    img = captureScreen();
    if (!img) {
      floatyMod.appendLog(panel, "OCR_flower_name: capture failed");
      return;
    }
    var ocrResult = _paddleOcr(img);
    floatyMod.appendLog(panel, "── Whole-page OCR (white, first click) ──");
    if (ocrResult && ocrResult.length > 0) {
      var addedNew = false;
      for (var oi = 0; oi < ocrResult.length; oi++) {
        var word = String(ocrResult[oi]).trim();
        if (word.length === 0) continue;
        // Keep only pure Chinese lines — drop any token containing a digit or
        // Latin letter (counts, coordinates, timestamps, panel log echoes).
        if (/[0-9A-Za-z]/.test(word)) continue;
        // Drop the nectar-essence UI label and strip the white color prefix so
        // only flower names remain (the whole-page dump only runs on white).
        if (word.indexOf("精華") !== -1) continue;
        word = word.replace(/白色/g, "");
        // Split multi-name tokens on spaces into separate lines and drop
        // single-character pieces ("菊") — only real flower names (2+ chars).
        var pieces = word.split(/\s+/);
        for (var pi = 0; pi < pieces.length; pi++) {
          var piece = pieces[pi].trim();
          if (piece.length <= 1) continue;
          var subPieces = _splitLongNames(piece);
          for (var si = 0; si < subPieces.length; si++) {
            var name = subPieces[si];
            if (name.length <= 1) continue;
            // Only words missing from the list are reported; each becomes a
            // search keyword for this run and future runs (persisted below).
            if (searchKeywords.indexOf(name) === -1) {
              searchKeywords.splice(1, 0, name);
              floatyMod.appendLog(panel, "NEW OCR: " + name);
              addedNew = true;
            }
          }
        }
      }
      if (addedNew) _saveExtraKeywords();
    } else {
      floatyMod.appendLog(panel, "OCR: (no text recognized)");
    }
    floatyMod.appendLog(panel, "── End whole-page OCR ──");
  } catch (e) {
    floatyMod.appendLog(panel, "Whole-page OCR failed: " + e);
  } finally {
    if (img) img.recycle();
  }
}

function feedPikmin(config, panel) {
  var templateDir =
    (config && config.detection && config.detection.templateDir) ||
    "./templates/";

  // Log the full search list every run before feeding starts so the user
  // can verify what will be searched.
  floatyMod.appendLog(panel, "Search list (" + (searchKeywords.length - 1) + "): " + searchKeywords.slice(1).join(" / "));

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
    floatyMod.appendLog(panel, "Pikmin page not visible within timeout; waiting and retrying...");
    // Wait and retry until pikmin page is visible
    for (var nectarRetry = 0; nectarRetry < 10; nectarRetry++) {
      sleep(2000);
      var retryImg = null;
      try {
        retryImg = captureScreen();
        if (retryImg) {
          var retryMatch = _findFirstMatch(retryImg, pikminPageTemplates, 0.7);
          if (retryMatch) {
            pikminPageVisible = true;
            floatyMod.appendLog(panel, "Pikmin page found on retry " + (nectarRetry + 1));
            break;
          }
        }
      } finally {
        if (retryImg) retryImg.recycle();
      }
    }
  }
  if (!pikminPageVisible) {
    floatyMod.appendLog(panel, "Pikmin page still not visible, proceeding anyway...");
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
  var closeSearchTemplates = _loadSpecificTemplates(templateDir, "feeding/feed", ["close search.jpg"]);
  if (searchTemplates.length === 0) {
    floatyMod.appendLog(panel, "No search templates found");
    return;
  }

  var midX = Math.round(device.width / 2);
  var midY = Math.round(device.height / 2);

  // can-feed gate templates + back button (used inside feeding rounds).
  var canFeedTemplates = _loadTemplatesFromDir(templateDir, "feeding/feed/can feed");
  if (canFeedTemplates.length === 0) {
    floatyMod.appendLog(panel, "Warning: no templates in feeding/feed/can feed, nectar will be skipped");
  }
  var backTemplates = _loadSpecificTemplates(templateDir, "feeding/feed", ["back.jpg"]);

  // Collectible items (templates/feeding/collect/ click/ + hold/) — collected
  // after zoom-out in each feed round, before the scroll gestures.
  var collectTemplates = collectFeedingMod.loadCollectTemplates(templateDir);

  // Close-family templates from common/ (Close*.jpg, closebtn.jpg) — used to
  // dismiss the search dialog BEFORE color detection. The dialog stays open
  // after typing + Enter (Enter only closes the keyboard) and covers the
  // color filter chips. Only Close-named templates are used here — NOT the
  // full common/ set (Confirm/Collect/Back would tap the wrong action).
  var closeDialogTemplates = [];
  (function () {
    var allCommon = matcher.loadAllTemplates(files.join(templateDir, "common"), { excludeDirs: [] });
    for (var c = 0; c < allCommon.length; c++) {
      if (allCommon[c].name.toLowerCase().indexOf("close") !== -1) {
        closeDialogTemplates.push(allCommon[c]);
      }
    }
  })();

  // Tap the search button (search.jpg). Must already be on the nectar page.
  // If search.jpg not found, try closing the search overlay first.
  function _tapSearch() {
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
          sleep(1000);
          return true;
        }
      } finally {
        if (img) img.recycle();
      }
      var elapsed = Date.now() - startTime;
      if (elapsed < 2000) sleep(2000 - elapsed);
    }

    // Could not find search.jpg — try closing search overlay first
    if (closeSearchTemplates.length > 0) {
      floatyMod.appendLog(panel, "Search not found, trying to close search overlay...");
      var closeImg = null;
      try {
        closeImg = captureScreen();
        if (closeImg) {
          var closeMatch = _findFirstMatch(closeImg, closeSearchTemplates, 0.7);
          if (closeMatch) {
            _tapAt(closeMatch, "Tap " + closeMatch.name + " (close search)", panel);
            sleep(2000);
          }
        }
      } finally {
        if (closeImg) closeImg.recycle();
      }
    }

    // Retry finding search.jpg after closing overlay
    for (var retryAttempt = 0; retryAttempt < 5; retryAttempt++) {
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
          sleep(1000);
          return true;
        }
      } finally {
        if (img) img.recycle();
      }
      var elapsed = Date.now() - startTime;
      if (elapsed < 2000) sleep(2000 - elapsed);
    }

    floatyMod.appendLog(panel, "Could not find search button");
    return false;
  }

  // From the BASE screen back to the search UI:
  //   double-click Feeding page → wait for pikmin page → click nectar page → tap search.
  function _reopenSearch() {
    // First, try to close search overlay if it's open (from previous keyword)
    if (closeSearchTemplates.length > 0) {
      var closeBeforeImg = null;
      try {
        closeBeforeImg = captureScreen();
        if (closeBeforeImg) {
          var closeBeforeMatch = _findFirstMatch(closeBeforeImg, closeSearchTemplates, 0.7);
          if (closeBeforeMatch) {
            floatyMod.appendLog(panel, "Closing existing search overlay before reopen...");
            _tapAt(closeBeforeMatch, "Tap " + closeBeforeMatch.name + " (close search)", panel);
            sleep(2000);
          }
        }
      } finally {
        if (closeBeforeImg) closeBeforeImg.recycle();
      }
    }

    var reClicked = feedingActions.doubleClickFeedingPage(templateDir, 2000, "reopen feeding", panel);
    if (!reClicked) {
      floatyMod.appendLog(panel, "Feeding page not found while reopening");
    }
    sleep(2000);

    // Wait for pikmin page to be visible before clicking nectar page
    floatyMod.appendLog(panel, "Waiting for pikmin page before clicking nectar page...");
    var pikminVisibleForReopen = false;
    for (var reopenWait = 0; reopenWait < 10; reopenWait++) {
      var reopenImg = null;
      try {
        reopenImg = captureScreen();
        if (reopenImg) {
          var reopenMatch = _findFirstMatch(reopenImg, pikminPageTemplates, 0.7);
          if (reopenMatch) {
            pikminVisibleForReopen = true;
            break;
          }
        }
      } finally {
        if (reopenImg) reopenImg.recycle();
      }
      sleep(2000);
    }
    if (!pikminVisibleForReopen) {
      floatyMod.appendLog(panel, "Pikmin page not visible in reopen, proceeding anyway...");
    }

    floatyMod.appendLog(panel, "Clicking nectar page at fixed position (550,2012)...");
    floatyMod.withPanelHidden(panel, function () {
      press(nectarPageX, nectarPageY, 1000);
    });
    sleep(2000);
    return _tapSearch();
  }

  // Press Enter to confirm the search AND close the keyboard. KeyCode(code)
  // is the AutoJS6 API for hardware keys — automator.press() only accepts
  // coordinates and crashes with a bare keycode (seen on device: "Invalid
  // arguments [(66.0)] for automator.press"). Falls back to the old
  // middle-of-screen double tap if KeyCode is unavailable.
  function _pressEnter() {
    // Use middle-tap directly to close keyboard — KeyCode can hang
    floatyMod.appendLog(panel, "Tapping middle to close keyboard");
    _multiTap(midX, midY, panel, 1);
    return true;
  }

  // Bounded, NON-BLOCKING field lookup. findOne(timeout) can hang the whole
  // script forever on Pikmin Bloom's game UI (seen on device: froze at
  // "Typing search keyword" with no further logs, no error thrown). findOnce()
  // returns immediately (null when nothing found yet), so we poll it until our
  // own deadline — the script ALWAYS makes progress.
  function _findInputField(timeoutMs) {
    var deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      var node = null;
      try {
        node =
          text("Search").findOnce() ||
          text("搜索").findOnce() ||
          className("EditText").findOnce();
      } catch (e) {
        // A single query error must not abort the poll — keep trying until
        // the deadline so the script can never freeze here.
        node = null;
      }
      if (node) return node;
      sleep(200);
    }
    return null;
  }

  // Type the keyword into the search field. Primary path is the old proven
  // method: find the field with a UI selector, then setText on the returned
  // object. The global setText(0, ...)/input(0, ...) index-based calls only
  // work when the game exposes the field to accessibility — Pikmin Bloom
  // does not, so they are last-resort fallbacks only.
  function _typeKeyword(keyword) {
    floatyMod.appendLog(panel, "Typing search keyword: " + keyword);
    var typed = false;

    // Click search field at (300, 510) before trying to type
    sleep(1000);
    floatyMod.appendLog(panel, "Clicking search field at (300, 510)...");
    click(300, 510);
    sleep(500);

    // 1. Old proven method: find the field via UI selector, then setText on
    //    the object (NOT the global setText(index, text)). Uses findOnce()
    //    polling so it can never freeze like findOne(timeout) did.
    var inputField = _findInputField(4000);
    if (inputField) {
      try {
        typed = inputField.setText(keyword) !== false;
        floatyMod.appendLog(panel, "Typed via inputField.setText");
      } catch (e) {
        typed = false;
        floatyMod.appendLog(panel, "inputField.setText failed: " + e);
      }
    }

    // 2. The field may need a moment to appear — retry the poll once.
    if (!typed) {
      sleep(500);
      inputField = _findInputField(2000);
      if (inputField) {
        try {
          typed = inputField.setText(keyword) !== false;
          floatyMod.appendLog(panel, "Typed via inputField.setText (retry)");
        } catch (e2) {
          floatyMod.appendLog(panel, "find/setText retry failed: " + e2);
        }
      }
    }

    // 3. Last resorts: global setText / input by field index.
    if (!typed) {
      try {
        typed = setText(0, keyword) !== false;
      } catch (e3) {
        floatyMod.appendLog(panel, "setText failed: " + e3);
      }
    }
    if (!typed) {
      try {
        typed = input(0, keyword) !== false;
      } catch (e4) {
        floatyMod.appendLog(panel, "input fallback failed: " + e4);
      }
    }

    if (!typed) {
      floatyMod.appendLog(panel, "Warning: could not type keyword via any method, clicking middle of screen to close keyboard/dialog");
      _multiTap(midX, midY, panel, 1);
    } else {
      sleep(500);
      _pressEnter();
    }
    sleep(2000);
  }

  // Close the search overlay WITHOUT retyping (the keyword already sits in
  // the field). Used between colors of the same keyword.
  function _closeSearch() {
    _pressEnter();
    sleep(2000);
  }

  // Dismiss any open dialog (e.g. the search overlay that stays open after
  // typing + Enter) BEFORE detecting a color template — the dialog covers
  // the color filter chips until dismissed. Uses only the Close-family
  // templates from common/. Returns true if a dialog was closed.
  // Feed all feedCount rounds for one color. Returns { rounds, stoppedEarly }.
  function _feedRounds(colorName, feedCount, flowersRegion, nectarRegion) {
    // feedNectar: feed nectar scroll path — edit freely.
    var feedNectar = [
      [576, 2000],
      [358, 1450],[763, 1450],
      [358, 1450],[763, 1450],
      [358, 1450],[763, 1450],
    ];
    // collectFlowers: collect flowers scroll path — edit freely.
    var collectFlowers = [
      [540, 1450],
      [110, 920],[1000, 920],[1000, 1010],[110, 1010],
      [110, 1100],[1000, 1100],[1000, 1190],[110, 1190],
      [110, 1280],[1000, 1280],[1000, 1370],[110, 1370],
      [110, 1460],[1000, 1460],[1000, 1550],[110, 1550],
      [110, 1640],[1000, 1640],[1000, 1730],[110, 1730],
      [110, 1820],[1000, 1820],[1000, 1910],[110, 1910],
      [110, 1910],[1000, 1910],[1000, 1820],[110, 1820],
      [110, 1730],[1000, 1730],[1000, 1640],[110, 1640],
      [110, 1505],[1000, 1505],[1000, 1415],[110, 1415],
      [110, 1325],[1000, 1325],[1000, 1235],[110, 1235],
      [110, 1145],[1000, 1145],[1000, 1055],[110, 1055],
      [110, 965],[1000, 965],[1000, 875],[110, 875],
    ];

    // Only a SUCCESSFUL feed round counts toward feedCount; a failed
    // (no can-feed match) attempt retries WITHOUT consuming a round.
    var completedRounds = 0;
    var maxAttempts = feedCount * 3;
    var attempt = 0;
    var consecutiveFailures = 0;
    var stoppedEarly = false;
    while (completedRounds < feedCount && attempt < maxAttempts) {
      attempt++;
      floatyMod.appendLog(panel, "Feed round " + (completedRounds + 1) + "/" + feedCount + " (" + colorName + ")");

      // 0. Tap middle between flowers and nectar regions
      var middleX = Math.round(flowersRegion[0] + flowersRegion[2] / 2);
      var flowersCenterY = flowersRegion[1] + flowersRegion[3] / 2;
      var nectarCenterY = nectarRegion[1] + nectarRegion[3] / 2;
      var middleY = Math.round((flowersCenterY + nectarCenterY) / 2);
      floatyMod.appendLog(panel, "Tapping middle between flowers and nectar at (" + middleX + ", " + middleY + ")...");
      click(middleX, middleY);
      sleep(1500);

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

      // 4. Only when can-feed was detected: collect any visible
      //    collectible items (feeding/collect) → zoom out → feed nectar
      //    → collect flowers.
      if (canFeed) {
        // Collect every visible collectible item (fruit/seedling) BEFORE
        // zooming out, reusing the shared collect loop from
        // collect_feeding.js.
        if (collectTemplates.length > 0) {
          floatyMod.appendLog(panel, "Collecting visible feeding items...");
collectFeedingMod.collectVisibleItems(collectTemplates, panel, {
          threshold: 0.85,
          maxConsecutiveMisses: 1,
        });
        } else {
          floatyMod.appendLog(panel, "No collect templates in feeding/collect, skipping collect loop");
        }

        scroll.zoom("out", 1, panel);
        sleep(500);

        // NOTE: The scroll gestures below ALWAYS run after the collect loop,
        // whether or not any collectible item matched — collect → zoom-out
        // → feed nectar → collect flowers, guaranteed.
        floatyMod.appendLog(panel, "Feeding nectar...");
        try {
          gestures([10000].concat(feedNectar));
        } catch (e) {
          floatyMod.appendLog(panel, "Feed nectar gesture failed: " + e);
        }
        sleep(500);
        floatyMod.appendLog(panel, "Collecting flowers...");
        try {
          gestures([6000].concat(collectFlowers));
        } catch (e) {
          floatyMod.appendLog(panel, "Collect flowers gesture failed: " + e);
        }
        sleep(2500);
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
        var reClicked = feedingActions.doubleClickFeedingPage(templateDir, 2000, "round re-trigger", panel);
        if (reClicked) {
          sleep(2000);
        } else {
          floatyMod.appendLog(panel, "Feeding page not found for next round");
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

    return { rounds: completedRounds, stoppedEarly: stoppedEarly };
  }

  // =====================================================================
  // Main: for EACH search keyword, rotate through ALL colors
  // (white → yellow → red → blue) and feed every color that has
  // feedCount > 0. After blue, the next keyword restarts the rotation.
  // =====================================================================
  var colorNames = ["white", "yellow", "red", "blue"];
  var results = [];
  var totalRounds = 0;
  var needReopen = false;   // true when the last action left us on the BASE screen
  var aborted = false;

  for (var kwIdx = 0; kwIdx < searchKeywords.length; kwIdx++) {
    var keyword = searchKeywords[kwIdx];
    floatyMod.appendLog(panel, "=== Search keyword " + (kwIdx + 1) + "/" + searchKeywords.length + ": " + keyword + " ===");

    // Reach the search UI for this keyword.
    if (kwIdx === 0) {
      // Initial navigation ended on the nectar page — open the search overlay,
      // then type the first keyword.
      _tapSearch();
      _typeKeyword(keyword);
    } else if (needReopen) {
      // Previous keyword's last color was fed → we are on the base screen.
      _reopenSearch();
      _typeKeyword(keyword);
    } else {
      // Previous keyword's last color was NOT fed → still on the nectar page.
      if (!_tapSearch()) {
        floatyMod.appendLog(panel, "Cannot find search for keyword '" + keyword + "', skipping");
        continue;
      }
      _typeKeyword(keyword);
    }
    needReopen = false;

    var anyFedThisKeyword = false;
    for (var ci = 0; ci < colorNames.length; ci++) {
      var colorName = colorNames[ci];

      if (needReopen) {
        // Previous color was fed → we are back on the base screen. Reopen
        // the search dialog AND retype the keyword — the field does NOT
        // persist across the feed cycle (the nectar page is reloaded), so
        // without retyping the color filter would apply to an empty search
        // and pick up no flowers.
        _reopenSearch();
        _typeKeyword(keyword);
        needReopen = false;
      }

      // Click the specific color template (e.g. white.jpg).
      var colorTemplates = _loadSpecificTemplates(templateDir, "feeding/feed", [colorName + ".jpg"]);
      if (colorTemplates.length === 0) {
        floatyMod.appendLog(panel, "No template for " + colorName + ".jpg, skipping color");
        continue;
      }

      var colorClicked = false;
      for (var colorTry = 0; colorTry < 5; colorTry++) {
        var startTime = Date.now();
        var colorImg = null;
        var colorMatch = null;
        floatyMod.withPanelHidden(panel, function () {
          try {
            colorImg = captureScreen();
            if (!colorImg) {
              sleep(1000);
              return;
            }
            colorMatch = _findFirstMatch(colorImg, colorTemplates, 0.7);
            if (colorMatch) {
              _tapAt(colorMatch, "Tap " + colorMatch.name + " (color)", panel);
              colorClicked = true;
            }
          } finally {
            if (colorImg) colorImg.recycle();
          }
        });
        if (colorClicked) break;
        var elapsed = Date.now() - startTime;
        if (elapsed < 2000) sleep(2000 - elapsed);
      }

      if (!colorClicked) {
        floatyMod.appendLog(panel, "Could not find " + colorName + " on screen, trying next color");
        continue;
      }

      // Dump whole-page Chinese text once on the very first white-page click
      // (keyword 0 + color 0); later passes keep the fast region OCR only.
      // DISABLED: OCR-driven keyword discovery is temporarily turned off.
      // if (kwIdx === 0 && ci === 0) {
      //   OCR_flower_name(panel);
      // }

      sleep(2000);

      // Read flowers/nectar numbers for this color via OCR.
      var feedCount = 0;
      var colorScreenImg = null;
      try {
        colorScreenImg = captureScreen();
        if (!colorScreenImg) {
          floatyMod.appendLog(panel, "Failed to capture screen for OCR on " + colorName);
          continue;
        }

        var feedingCfg = (config && config.feeding) || {};
        var flowersRegion = [
          feedingCfg.flowerX || 0,
          feedingCfg.flowerY || 475,
          300, 100
        ];
        var nectarRegion = [
          feedingCfg.nectarX || 0,
          feedingCfg.nectarY || 660,
          300, 100
        ];

        // Empty-keyword pass uses base Y values directly — no -40 filter
        // offset, no +220 activity offset. The activity banner only
        // appears on the filtered (non-empty keyword) screen layout, so
        // its Y shift must not leak into the unfiltered pass.
        if (keyword !== "") {
          flowersRegion[1] -= 40;
          nectarRegion[1] -= 40;

          var activityTemplates = _loadSpecificTemplates(templateDir, "feeding", ["activity.jpg"]);
          // Reuse colorScreenImg for the activity check instead of calling
          // captureScreen() again — AutoJS6 returns the same underlying Java
          // Bitmap on back-to-back captures with no sleep between them, so a
          // second capture here would alias colorScreenImg and its recycle()
          // would invalidate the image used by the OCR pass below
          // (IllegalStateException: Image has been recycled in images.clip).
          if (activityTemplates.length > 0) {
            var activityMatch = _findFirstMatch(colorScreenImg, activityTemplates, 0.7);
            if (activityMatch) {
              flowersRegion[1] += 170;
              nectarRegion[1] += 170;
              floatyMod.appendLog(panel, "Activity detected — Y +170 for flowers and nectar");
            } else {
              floatyMod.appendLog(panel, "Activity not detected — using base Y values");
            }
          } else {
            floatyMod.appendLog(panel, "activity.jpg template not found — skipping activity check");
          }
        } else {
          floatyMod.appendLog(panel, "Empty keyword — using base Y values (no activity offset)");
        }

        // Calculate maxFlowers first so we can use it for the OCR-failure predicate.
        var pikminAccount = (config && config.account && config.account.pikminAccount) || 1;
        var maxFlowers = pikminAccount === 2
          ? (feedingCfg.maxFlowerSecond || 1200)
          : (feedingCfg.maxFlowerMain || 1200);

        floatyMod.appendLog(panel, "OCR flower region: x=" + flowersRegion[0] + " y=" + flowersRegion[1] + " w=" + flowersRegion[2] + " h=" + flowersRegion[3]);
        floatyMod.appendLog(panel, "OCR nectar region: x=" + nectarRegion[0] + " y=" + nectarRegion[1] + " w=" + nectarRegion[2] + " h=" + nectarRegion[3]);

        var ocrResult = _ocrFlowersAndNectarWithBump(
          flowersRegion[0], flowersRegion[1], flowersRegion[2], flowersRegion[3],
          nectarRegion[0], nectarRegion[1], nectarRegion[2], nectarRegion[3],
          colorScreenImg, panel, maxFlowers
        );
        var flowersNum = ocrResult.flowersNum;
        var nectarNum = ocrResult.nectarNum;
        // OCR may have bumped Y to find the numbers; shift the regions so
        // _feedRounds' middle-tap lands on the actual location, not the
        // base Y from the config.
        if (ocrResult.yOffset > 0) {
          flowersRegion[1] += ocrResult.yOffset;
          nectarRegion[1] += ocrResult.yOffset;
          floatyMod.appendLog(panel, "Middle-tap Y bumped +" + ocrResult.yOffset + " → flowersY=" + flowersRegion[1] + ", nectarY=" + nectarRegion[1]);
        }
        floatyMod.appendLog(panel, "Flowers: " + flowersNum);
        floatyMod.appendLog(panel, "Number Nectar: " + nectarNum);

        var flowersNeeded = Math.floor((maxFlowers - flowersNum) / 80);
        var nectarCanFeed = Math.floor(nectarNum / 40);
        feedCount = Math.min(flowersNeeded, nectarCanFeed);

        floatyMod.appendLog(panel, "Feed count: " + feedCount + " (flowers=" + flowersNum + ", nectar=" + nectarNum + ")");
      } finally {
        if (colorScreenImg) colorScreenImg.recycle();
      }

      if (feedCount > 0) {
        anyFedThisKeyword = true;
        floatyMod.appendLog(panel, "Feeding " + feedCount + " round(s) of " + colorName);
        var feedResult = _feedRounds(colorName, feedCount, flowersRegion, nectarRegion);
        totalRounds += feedResult.rounds;
        results.push(colorName + ":" + feedResult.rounds);
        if (feedResult.stoppedEarly) {
          // Housekeeping already returned to the main page — cannot continue.
          aborted = true;
          break;
        }
        needReopen = true;   // feeding ends on the base screen
      } else {
        floatyMod.appendLog(panel, "Feed count is 0 for " + colorName + ", moving to next color");
      }
    }

    if (aborted) break;

    if (!anyFedThisKeyword) {
      floatyMod.appendLog(panel, "No color could be fed for keyword '" + keyword + "'");
    }
  }

  console.log("=== Feed Pikmin Results ===");
  console.log("Search keywords: " + searchKeywords.join(", "));
  console.log("Fed: " + (results.length > 0 ? results.join(", ") : "none"));
  console.log("Total rounds: " + totalRounds);
  console.log("===========================");
}

module.exports = { feedPikmin: feedPikmin };
