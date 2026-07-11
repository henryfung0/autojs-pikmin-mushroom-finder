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

var panel = floatyMod.createControlPanel(function() {
  floatyMod.destroy(panel);
  exit();
});

if (settings.autoLaunch) {
  floatyMod.appendLog(panel, "Launching " + config.app.packageName + "...");
  app.launchPackage(config.app.packageName);
  sleep(5000);

  var account = config.account.pikminAccount || 1;
  pikminIcon.detectAndClickIcon(config.detection.templateDir, account, panel);
  sleep(2000);
} else {
  floatyMod.appendLog(panel, "Auto-launch disabled. Open game manually.");
  sleep(5000);
}

if (settings.mode === "Advanture") {
  require("./daily_task/advanture/main").run(settings, panel);
} else if (settings.mode === "Pikmin Daily Task") {
  var throwFlow = require("./daily_task/seedlings/throw_repeated_seedling_flow");
  var advFlow   = require("./daily_task/advanture/advanture_flow");

  if (settings.enableCollect || settings.enableFarm || settings.enableThrowRepeated) {
    var trsResult = require("./daily_task/seedlings/throw_repeated_seedling_main").run(settings, panel);
  }
  if (!throwFlow.isShutdownRequested() && (settings.enableGift || settings.enableSeedling || settings.enableFruit)) {
    if (settings.enableGift !== undefined) config.advanture.enableGift = settings.enableGift;
    if (settings.enableSeedling !== undefined) config.advanture.enableSeedling = settings.enableSeedling;
    if (settings.enableFruit !== undefined) config.advanture.enableFruit = settings.enableFruit;
    if (trsResult && trsResult.panel) {
      floatyMod.appendLog(panel, "Starting adventure flow (continuing from throw repeated seedling)");
      floatyMod.updateStatus(panel, "Scanning...");
      advFlow.runAdvantureFlow(config, panel);
    } else {
      require("./daily_task/advanture/main").run(settings, panel);
    }
  }
  if (!throwFlow.isShutdownRequested() && settings.enableCollectFeeding !== false) {
    floatyMod.appendLog(panel, "Starting collect feeding...");
    var collectFeeding = require("./daily_task/advanture/collect_feeding");
    collectFeeding.runCollectFeeding(config, panel);
  }
  floatyMod.appendLog(panel, "Pikmin Daily Task finished");
  sleep(3000);
  floatyMod.destroy(panel);
} else {
  require("./mushroom_finder/main").run(settings);
}
