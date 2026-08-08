"auto";

/**
 * settings_store.js
 *
 * Persistent storage for the config dialog settings, backed by AutoJS6's
 * `storages` API. Values survive script restarts: every setting returned by
 * the config dialog is written back here on Start, and re-applied to the
 * dialog on the next run so the user does not have to re-select everything.
 *
 * Exports:
 *   load()           → {Object} previously saved settings ({} when none)
 *   save(values)     → persist a dialog settings object (known keys only)
 *   clear()          → wipe all saved settings (used by the Reset button)
 */

var STORE_NAME = "pikmin_config";

// Keys persisted from the config dialog (showConfigDialog → settings object).
// Must stay in sync with the `values` object built by the Start button.
var KEYS = [
  "mode",
  "autoLaunch",
  "threshold",
  "largeColorThreshold",
  "largeElementThreshold",
  "detectLargeColor",
  "detectLargeElement",
  "settleDelay",
  "maxEmptyScrolls",
  "maxEmptyLoops",
  "enableCollect",
  "enableFarm",
  "enableThrowRepeated",
  "enableCollectFeeding",
  "enableFeedPikmin",
  "enableGift",
  "enableSeedling",
  "enableFruit",
  "pikminAccount",
  "maxFlowerMain",
  "maxFlowerSecond"
];

function _store() {
  return storages.create(STORE_NAME);
}

/**
 * Read all persisted settings. Returns {} when nothing was saved yet or when
 * storage is unavailable — the caller must treat {} as "use dialog defaults".
 */
function load() {
  var saved = {};
  try {
    var s = _store();
    for (var i = 0; i < KEYS.length; i++) {
      var key = KEYS[i];
      var value = s.get(key, null);
      if (value !== null && value !== undefined) {
        saved[key] = value;
      }
    }
  } catch (e) {
    console.warn("settings_store: load failed: " + e);
  }
  return saved;
}

/**
 * Persist the settings object produced by the config dialog's Start button.
 * Only known keys are written; anything else in `values` is ignored.
 */
function save(values) {
  if (!values) return;
  try {
    var s = _store();
    for (var key in values) {
      if (KEYS.indexOf(key) !== -1) {
        s.put(key, values[key]);
      }
    }
  } catch (e) {
    console.warn("settings_store: save failed: " + e);
  }
}

/** Remove all saved settings (Reset button). */
function clear() {
  try {
    _store().clear();
  } catch (e) {
    console.warn("settings_store: clear failed: " + e);
  }
}

module.exports = { load: load, save: save, clear: clear };
