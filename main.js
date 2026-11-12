"auto";

var config    = require("./ui/config");
var configUi  = require("./ui/config_ui");
var floatyMod = require("./ui/floaty");
var pikminIcon = require("./lib/pikmin_icon");

var thisEngine = engines.myEngine();
engines.all().forEach(function(engine) {
  if (engine.id !== thisEngine.id) {
    engine.forceStop();
  }
});

function accountLabel(account) {
  if (account === 2) return "Second AC";
  if (account === 3) return "Both AC";
  return "Main AC";
}

var settings = configUi.showConfigDialog();
if (!settings) {
  exit();
}

var captureGranted = false;
try {
  captureGranted = images.requestScreenCapture(false);
} catch (e) {
  console.warn("requestScreenCapture threw: " + e);
}
if (!captureGranted) {
  toast("Screen capture permission denied. Grant permission and restart.");
  exit();
}

if (settings.pikminAccount !== undefined) {
  config.account.pikminAccount = settings.pikminAccount;
}
if (typeof settings.maxFlowerMain === "number") {
  config.feeding.maxFlowerMain = settings.maxFlowerMain;
}
if (typeof settings.maxFlowerSecond === "number") {
  config.feeding.maxFlowerSecond = settings.maxFlowerSecond;
}
if (typeof settings.flowerX === "number") config.feeding.flowerX = settings.flowerX;
if (typeof settings.flowerY === "number") config.feeding.flowerY = settings.flowerY;
if (typeof settings.nectarX === "number") config.feeding.nectarX = settings.nectarX;
if (typeof settings.nectarY === "number") config.feeding.nectarY = settings.nectarY;
if (Array.isArray(settings.searchKeywords)) config.feeding.searchKeywords = settings.searchKeywords;

var panel = floatyMod.createControlPanel(function() {
  floatyMod.destroy(panel);
  exit();
});

if (settings.autoLaunch) {
  var initialAccount = config.account.pikminAccount === 3 ? 1 : (config.account.pikminAccount || 1);
  pikminIcon.launchAndDetectIcon(
    config.app.packageName,
    config.detection.templateDir,
    initialAccount,
    panel
  );
} else {
  floatyMod.appendLog(panel, "Auto-launch disabled. Open game manually.");
  sleep(5000);
}

if (settings.mode === "Advanture") {
  require("./daily_task/advanture/main").run(settings, panel);
} else if (settings.mode === "Pikmin Daily Task") {
  var throwFlow      = require("./daily_task/seedlings/throw_repeated_seedling_flow");
  var advFlow        = require("./daily_task/advanture/advanture_flow");
  var collectFeeding = require("./daily_task/advanture/collect_feeding");
  var feedPikmin     = require("./daily_task/feeding/feed_pikmin");

  if (settings.threshold !== undefined) config.detection.threshold = settings.threshold;
  if (settings.settleDelay !== undefined) config.scan.settleDelay = settings.settleDelay;
  if (settings.maxEmptyLoops !== undefined) config.advanture.maxEmptyLoops = settings.maxEmptyLoops;
  if (settings.enableGift !== undefined) config.advanture.enableGift = settings.enableGift;
  if (settings.enableSeedling !== undefined) config.advanture.enableSeedling = settings.enableSeedling;
  if (settings.enableFruit !== undefined) config.advanture.enableFruit = settings.enableFruit;

  // Both Ac (3): run the full daily task for account 1, then account 2.
  var selectedAccount = config.account.pikminAccount || 1;
  var accountsToRun = selectedAccount === 3 ? [1, 2] : [selectedAccount];

  for (var accIdx = 0; accIdx < accountsToRun.length; accIdx++) {
    if (throwFlow.isShutdownRequested()) break;

    var currentAccount = accountsToRun[accIdx];

    // The first account was launched above. Switching accounts always needs
    // a launch+tap, even when auto-launch is off — otherwise Both Ac would
    // just re-run the account already in the foreground.
    if (accIdx > 0) {
      floatyMod.appendLog(panel, "=== Switching to " + accountLabel(currentAccount) + " ===");
      pikminIcon.launchAndDetectIcon(
        config.app.packageName,
        config.detection.templateDir,
        currentAccount,
        panel
      );
      sleep(2000);
    }

    // feed_pikmin reads this to pick maxFlowerMain vs maxFlowerSecond.
    config.account.pikminAccount = currentAccount;
    floatyMod.appendLog(panel, "=== " + accountLabel(currentAccount) + ": seeding → adventure → feeding ===");

    if (settings.enableCollect || settings.enableFarm || settings.enableThrowRepeated) {
      require("./daily_task/seedlings/throw_repeated_seedling_main").run(settings, panel);
    }

    if (!throwFlow.isShutdownRequested() &&
        (settings.enableGift || settings.enableSeedling || settings.enableFruit)) {
      floatyMod.appendLog(panel, "Starting adventure flow...");
      floatyMod.updateStatus(panel, "Scanning...");
      advFlow.runAdvantureFlow(config, panel);
    }

    if (!throwFlow.isShutdownRequested() && settings.enableCollectFeeding !== false) {
      floatyMod.appendLog(panel, "Starting collect feeding...");
      collectFeeding.runCollectFeeding(config, panel);
    }

    if (!throwFlow.isShutdownRequested() && settings.enableFeedPikmin) {
      floatyMod.appendLog(panel, "Starting feed pikmin...");
      feedPikmin.feedPikmin(config, panel);
    }
  }

  floatyMod.appendLog(panel, "Pikmin Daily Task finished");
  sleep(3000);
  floatyMod.destroy(panel);
} else {
  require("./mushroom_finder/main").run(settings, panel);
}

require("./lib/lock_screen").lockScreenAndExit();
