/**
 * config_ui.js
 *
 * Combined settings dialog for Pikmin Bloom automation (Mushroom Finder / Advanture modes).
 * Shows a single dialog with mode selection, common settings, and mode-specific
 * configuration sections that toggle based on the selected mode.
 *
 * Exports:
 *   showConfigDialog() - Show the combined dialog, return settings object or null
 */

var settingsStore = require("./settings_store");

/**
 * Show the combined config dialog.
 *
 * @returns {Object|null} Settings object with keys:
 *   {string}  mode             - Selected automation mode ("Mushroom Finder" or "Advanture")
 *   {boolean} autoLaunch       - Auto-launch Pikmin Bloom
 *   {number}  threshold        - Confidence threshold (0.70 – 0.99)
 *   {boolean} detectLargeColor - Include large color mushrooms
 *   {boolean} detectLargeElement - Include large element mushrooms
 *   {number}  settleDelay      - Post-swipe settle delay in ms (500 – 10000)
 *   {number}  maxEmptyScrolls  - Max empty scrolls before re-centering (1 – 15)
 *   Returns null if the user pressed Exit or cancelled.
 */
function showConfigDialog() {
  var view = ui.inflate(
    <frame bg="#FFFFFF">
      <vertical padding="16 8">
        <text text="Pikmin Bloom" textSize="18sp" textColor="#212121"
              gravity="center" margin="0 0 0 8"/>

        <checkbox id="autoLaunch" text="Auto-launch Pikmin Bloom"
                  checked="true" textSize="14sp" textColor="#212121" margin="0 0 8 0"/>

        <spinner id="modeSelector" entries="Mushroom Finder|Pikmin Daily Task"
                 textSize="14sp" textColor="#212121" gravity="center" margin="0 0 16 0"/>

        <ScrollView layout_weight="1">
          <vertical padding="0 0 0 8">
            <vertical id="mushroomSettings" visibility="gone">
              <text text="Confidence Threshold: 0.85" textSize="13sp"
                    textColor="#616161" margin="0 4 0 0" id="thresholdLabel"/>
              <text text="0.85" textSize="12sp" textColor="#757575"
                    gravity="end" id="thresholdValue"/>
              <seekbar id="threshold" progress="15" max="29" margin="0 0 0 8"/>

              <text text="Settle Delay: 2.5s" textSize="13sp"
                    textColor="#616161" margin="0 4 0 0" id="settleDelayLabel"/>
              <text text="2.5" textSize="12sp" textColor="#757575"
                    gravity="end" id="settleDelayValue"/>
              <seekbar id="settleDelay" progress="4" max="19" margin="0 0 0 8"/>

              <text text="Max Empty Scrolls: 5" textSize="13sp"
                    textColor="#616161" margin="0 4 0 0" id="maxEmptyScrollsLabel"/>
              <text text="5" textSize="12sp" textColor="#757575"
                    gravity="end" id="maxEmptyScrollsValue"/>
              <seekbar id="maxEmptyScrolls" progress="4" max="14" margin="0 0 0 8"/>

              <checkbox id="detectLargeColor" text="Include large color mushrooms"
                        checked="true" textSize="14sp" textColor="#212121" margin="0 4 0 4"/>
              <text text="Large Color Threshold: 0.75" textSize="13sp"
                    textColor="#616161" margin="0 4 0 0" id="largeColorThresholdLabel"/>
              <text text="0.75" textSize="12sp" textColor="#757575"
                    gravity="end" id="largeColorThresholdValue"/>
              <seekbar id="largeColorThreshold" progress="5" max="29" margin="0 0 0 8"/>

              <text text="Large Element Threshold: 0.75" textSize="13sp"
                    textColor="#616161" margin="0 4 0 0" id="largeElementThresholdLabel"/>
              <text text="0.75" textSize="12sp" textColor="#757575"
                    gravity="end" id="largeElementThresholdValue"/>
              <seekbar id="largeElementThreshold" progress="5" max="29" margin="0 0 0 8"/>
              <checkbox id="detectLargeElement" text="Include large element mushrooms"
                        checked="true" textSize="14sp" textColor="#212121" margin="0 0 0 4"/>
            </vertical>

            <vertical id="advantureSettings">
              <spinner id="accountSelector" entries="Main Ac|Second Ac|Both Ac"
                       textSize="14sp" textColor="#212121" margin="0 8 0 8"/>

              <horizontal gravity="center_vertical">
                <checkbox id="enableSeedlingGroup" text="1. Seedling" checked="true" layout_weight="1"
                         textSize="14sp" textColor="#1976D2" textStyle="bold" margin="0 8 0 4"/>
                <button id="toggleSeedlingGroup" text="▸" textSize="16sp" textColor="#1976D2"
                        style="Widget.AppCompat.Button.ButtonBar.AlertDialog" margin="0 8 0 4"/>
              </horizontal>
              <vertical id="seedlingGroupOptions" visibility="gone">
                <checkbox id="enableCollect" text="Collect seedlings" checked="true"
                         textSize="14sp" textColor="#212121" margin="24 0 0 4"/>
                <checkbox id="enableFarm" text="Farm seedlings" checked="true"
                         textSize="14sp" textColor="#212121" margin="24 0 0 4"/>
                <checkbox id="enableThrowRepeated" text="Throw repeated seedlings" checked="true"
                         textSize="14sp" textColor="#212121" margin="24 0 0 4"/>
              </vertical>

              <horizontal gravity="center_vertical">
                <checkbox id="enableAdventureGroup" text="2. Adventure" checked="true" layout_weight="1"
                         textSize="14sp" textColor="#1976D2" textStyle="bold" margin="0 8 0 4"/>
                <button id="toggleAdventureGroup" text="▸" textSize="16sp" textColor="#1976D2"
                        style="Widget.AppCompat.Button.ButtonBar.AlertDialog" margin="0 8 0 4"/>
              </horizontal>
              <vertical id="adventureGroupOptions" visibility="gone">
                <checkbox id="enableGift" text="Gift" checked="true" textSize="14sp" textColor="#212121" margin="24 0 0 4"/>
                <checkbox id="enableSeedlingAdv" text="Seedling" checked="true" textSize="14sp" textColor="#212121" margin="24 0 0 4"/>
                <checkbox id="enableFruit" text="Fruit" checked="true" textSize="14sp" textColor="#212121" margin="24 0 0 4"/>
              </vertical>

              <horizontal gravity="center_vertical">
                <checkbox id="enableFeedingGroup" text="3. Feeding" checked="true" layout_weight="1"
                         textSize="14sp" textColor="#1976D2" textStyle="bold" margin="0 8 0 4"/>
                <button id="toggleFeedingGroup" text="▸" textSize="16sp" textColor="#1976D2"
                        style="Widget.AppCompat.Button.ButtonBar.AlertDialog" margin="0 8 0 4"/>
              </horizontal>
              <vertical id="feedingGroupOptions" visibility="gone">
                <checkbox id="enableCollectFeeding" text="Collect feeding" checked="true"
                         textSize="14sp" textColor="#212121" margin="24 0 0 4"/>
                <checkbox id="enableFeedPikmin" text="Feed Pikmin" checked="true"
                         textSize="14sp" textColor="#212121" margin="24 0 0 4"/>

                <text text="Max Empty Loops: 10" textSize="13sp"
                      textColor="#616161" margin="0 8 0 0" id="maxEmptyLoopsLabel"/>
                <text text="10" textSize="12sp" textColor="#757575"
                      gravity="end" id="maxEmptyLoopsValue"/>
                <seekbar id="maxEmptyLoops" progress="9" max="29" margin="0 0 0 8"/>
              </vertical>
            </vertical>
          </vertical>
        </ScrollView>

        <horizontal gravity="center" margin="12 8 0 0">
          <button id="resetBtn" text="Reset" textSize="13sp"
                  style="Widget.AppCompat.Button.ButtonBar.AlertDialog"
                  layout_weight="1"/>
          <button id="exitBtn" text="Exit" textSize="13sp"
                  style="Widget.AppCompat.Button.ButtonBar.AlertDialog"
                  layout_weight="1"/>
          <button id="startBtn" text="Start" textSize="13sp"
                  style="Widget.AppCompat.Button.ButtonBar.AlertDialog"
                  layout_weight="1"/>
        </horizontal>
      </vertical>
    </frame>
  );

  var dialogResult = { choice: null, values: null };

  // ── Mode spinner listener ────────────────────────
  view.modeSelector.setOnItemSelectedListener({
    onItemSelected: function(parent, viewRef, position, id) {
      if (position === 0) {  // Mushroom Finder selected
        view.mushroomSettings.visibility = android.view.View.VISIBLE;
        view.advantureSettings.visibility = android.view.View.GONE;
      } else {  // Pikmin Daily Task selected (position 1)
        view.mushroomSettings.visibility = android.view.View.GONE;
        view.advantureSettings.visibility = android.view.View.VISIBLE;
      }
    }
  });

  // ── Seekbar listeners ────────────────────────────

  // Confidence threshold (progress 0-29 → value 0.70-0.99)
  view.threshold.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = ((progress + 70) / 100).toFixed(2);
      view.thresholdValue.setText(value);
    }
  });

  // Settle delay (progress 0-19 → value 500-10000 ms)
  view.settleDelay.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = ((progress * 500) + 500) / 1000;
      view.settleDelayValue.setText(String(value));
    }
  });

  // Large color threshold (progress 0-29 → value 0.50-0.79)
  view.largeColorThreshold.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = ((progress + 50) / 100).toFixed(2);
      view.largeColorThresholdValue.setText(value);
    }
  });

  // Large element threshold (progress 0-29 → value 0.50-0.79)
  view.largeElementThreshold.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = ((progress + 50) / 100).toFixed(2);
      view.largeElementThresholdValue.setText(value);
    }
  });

  // Max empty scrolls (progress 0-14 → value 1-15)
  view.maxEmptyScrolls.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = progress + 1;
      view.maxEmptyScrollsValue.setText(String(value));
    }
  });

  // Max empty loops for advanture (progress 0-29 → value 1-30)
  view.maxEmptyLoops.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = progress + 1;
      view.maxEmptyLoopsValue.setText(String(value));
    }
  });

  // ── Group checkbox toggles ────────────────────────
  view.enableSeedlingGroup.on("click", function() {
    var checked = view.enableSeedlingGroup.isChecked();
    view.enableCollect.setChecked(checked);
    view.enableFarm.setChecked(checked);
    view.enableThrowRepeated.setChecked(checked);
  });
  view.enableCollect.on("click", function() {
    view.enableSeedlingGroup.setChecked(view.enableCollect.isChecked() && view.enableFarm.isChecked() && view.enableThrowRepeated.isChecked());
  });
  view.enableFarm.on("click", function() {
    view.enableSeedlingGroup.setChecked(view.enableCollect.isChecked() && view.enableFarm.isChecked() && view.enableThrowRepeated.isChecked());
  });
  view.enableThrowRepeated.on("click", function() {
    view.enableSeedlingGroup.setChecked(view.enableCollect.isChecked() && view.enableFarm.isChecked() && view.enableThrowRepeated.isChecked());
  });

  view.enableAdventureGroup.on("click", function() {
    var checked = view.enableAdventureGroup.isChecked();
    view.enableGift.setChecked(checked);
    view.enableSeedlingAdv.setChecked(checked);
    view.enableFruit.setChecked(checked);
  });
  view.enableGift.on("click", function() {
    view.enableAdventureGroup.setChecked(view.enableGift.isChecked() && view.enableSeedlingAdv.isChecked() && view.enableFruit.isChecked());
  });
  view.enableSeedlingAdv.on("click", function() {
    view.enableAdventureGroup.setChecked(view.enableGift.isChecked() && view.enableSeedlingAdv.isChecked() && view.enableFruit.isChecked());
  });
  view.enableFruit.on("click", function() {
    view.enableAdventureGroup.setChecked(view.enableGift.isChecked() && view.enableSeedlingAdv.isChecked() && view.enableFruit.isChecked());
  });

  view.enableFeedingGroup.on("click", function() {
    var checked = view.enableFeedingGroup.isChecked();
    view.enableCollectFeeding.setChecked(checked);
    view.enableFeedPikmin.setChecked(checked);
  });
  view.enableCollectFeeding.on("click", function() {
    view.enableFeedingGroup.setChecked(view.enableCollectFeeding.isChecked() && view.enableFeedPikmin.isChecked());
  });
  view.enableFeedPikmin.on("click", function() {
    view.enableFeedingGroup.setChecked(view.enableCollectFeeding.isChecked() && view.enableFeedPikmin.isChecked());
  });

  function toggleOptions(toggleBtn, optionsContainer) {
    var show = optionsContainer.visibility !== android.view.View.VISIBLE;
    optionsContainer.visibility = show ? android.view.View.VISIBLE : android.view.View.GONE;
    toggleBtn.setText(show ? "▾" : "▸");
  }
  view.toggleSeedlingGroup.on("click", function() {
    toggleOptions(view.toggleSeedlingGroup, view.seedlingGroupOptions);
  });
  view.toggleAdventureGroup.on("click", function() {
    toggleOptions(view.toggleAdventureGroup, view.adventureGroupOptions);
  });
  view.toggleFeedingGroup.on("click", function() {
    toggleOptions(view.toggleFeedingGroup, view.feedingGroupOptions);
  });

  // ── Restore last-saved settings ─────────────────
  // Must run AFTER all listeners are attached so seekbar label updates and
  // mode visibility toggling fire correctly.
  var saved = settingsStore.load();

  function _clamp(value, min, max) {
    value = Math.round(value);
    return Math.min(max, Math.max(min, value));
  }

  if (saved.mode) {
    var modePos = saved.mode === "Mushroom Finder" ? 0 : 1;
    view.modeSelector.setSelection(modePos);
    view.mushroomSettings.visibility = modePos === 0 ? android.view.View.VISIBLE : android.view.View.GONE;
    view.advantureSettings.visibility = modePos === 0 ? android.view.View.GONE : android.view.View.VISIBLE;
  } else {
    view.modeSelector.setSelection(1);
  }

  if (typeof saved.autoLaunch === "boolean") {
    view.autoLaunch.setChecked(saved.autoLaunch);
  }

  if (typeof saved.threshold === "number") {
    var tp = _clamp(saved.threshold * 100 - 70, 0, 29);
    view.threshold.setProgress(tp);
    view.thresholdValue.setText(((tp + 70) / 100).toFixed(2));
  }
  if (typeof saved.largeColorThreshold === "number") {
    var lcp = _clamp(saved.largeColorThreshold * 100 - 50, 0, 29);
    view.largeColorThreshold.setProgress(lcp);
    view.largeColorThresholdValue.setText(((lcp + 50) / 100).toFixed(2));
  }
  if (typeof saved.largeElementThreshold === "number") {
    var lep = _clamp(saved.largeElementThreshold * 100 - 50, 0, 29);
    view.largeElementThreshold.setProgress(lep);
    view.largeElementThresholdValue.setText(((lep + 50) / 100).toFixed(2));
  }
  if (typeof saved.settleDelay === "number") {
    var sdp = _clamp((saved.settleDelay - 500) / 500, 0, 19);
    view.settleDelay.setProgress(sdp);
    view.settleDelayValue.setText(String((sdp * 500 + 500) / 1000));
  }
  if (typeof saved.maxEmptyScrolls === "number") {
    var msp = _clamp(saved.maxEmptyScrolls - 1, 0, 14);
    view.maxEmptyScrolls.setProgress(msp);
    view.maxEmptyScrollsValue.setText(String(msp + 1));
  }
  if (typeof saved.maxEmptyLoops === "number") {
    var mlp = _clamp(saved.maxEmptyLoops - 1, 0, 29);
    view.maxEmptyLoops.setProgress(mlp);
    view.maxEmptyLoopsValue.setText(String(mlp + 1));
  }

  if (typeof saved.detectLargeColor === "boolean") view.detectLargeColor.setChecked(saved.detectLargeColor);
  if (typeof saved.detectLargeElement === "boolean") view.detectLargeElement.setChecked(saved.detectLargeElement);
  if (typeof saved.enableCollect === "boolean") view.enableCollect.setChecked(saved.enableCollect);
  if (typeof saved.enableFarm === "boolean") view.enableFarm.setChecked(saved.enableFarm);
  if (typeof saved.enableThrowRepeated === "boolean") view.enableThrowRepeated.setChecked(saved.enableThrowRepeated);
  if (typeof saved.enableCollectFeeding === "boolean") view.enableCollectFeeding.setChecked(saved.enableCollectFeeding);
  if (typeof saved.enableFeedPikmin === "boolean") view.enableFeedPikmin.setChecked(saved.enableFeedPikmin);
  if (typeof saved.enableGift === "boolean") view.enableGift.setChecked(saved.enableGift);
  if (typeof saved.enableSeedling === "boolean") view.enableSeedlingAdv.setChecked(saved.enableSeedling);
  if (typeof saved.enableFruit === "boolean") view.enableFruit.setChecked(saved.enableFruit);
  if (typeof saved.pikminAccount === "number") {
    view.accountSelector.setSelection(_clamp(saved.pikminAccount - 1, 0, 2));
  }

  view.enableSeedlingGroup.setChecked(view.enableCollect.isChecked() && view.enableFarm.isChecked() && view.enableThrowRepeated.isChecked());
  view.enableAdventureGroup.setChecked(view.enableGift.isChecked() && view.enableSeedlingAdv.isChecked() && view.enableFruit.isChecked());
  view.enableFeedingGroup.setChecked(view.enableCollectFeeding.isChecked() && view.enableFeedPikmin.isChecked());

  // ── Start button ─────────────────────────────────
  view.startBtn.on("click", function() {
    dialogResult.choice = "start";
    dialogResult.values = {
      mode: view.modeSelector.getSelectedItem(),
      autoLaunch: view.autoLaunch.isChecked(),
      threshold: (view.threshold.progress + 70) / 100,
      largeColorThreshold: (view.largeColorThreshold.progress + 50) / 100,
      largeElementThreshold: (view.largeElementThreshold.progress + 50) / 100,
      detectLargeColor: view.detectLargeColor.isChecked(),
      detectLargeElement: view.detectLargeElement.isChecked(),
      settleDelay: (view.settleDelay.progress * 500) + 500,
      maxEmptyScrolls: view.maxEmptyScrolls.progress + 1,
      enableCollect: view.enableCollect.isChecked(),
      enableFarm: view.enableFarm.isChecked(),
      enableThrowRepeated: view.enableThrowRepeated.isChecked(),
      enableCollectFeeding: view.enableCollectFeeding.isChecked(),
      enableFeedPikmin: view.enableFeedPikmin.isChecked(),
      enableGift: view.enableGift.isChecked(),
      enableSeedling: view.enableSeedlingAdv.isChecked(),
      enableFruit: view.enableFruit.isChecked(),
      maxEmptyLoops: view.maxEmptyLoops.progress + 1,
      pikminAccount: view.accountSelector.getSelectedItemPosition() + 1
    };
    settingsStore.save(dialogResult.values);
    d.dismiss();
  });

  // ── Reset button ─────────────────────────────────
  view.resetBtn.on("click", function() {
    view.threshold.setProgress(15);
    view.thresholdValue.setText("0.85");
    view.settleDelay.setProgress(4);
    view.settleDelayValue.setText("2.5");
    view.maxEmptyScrolls.setProgress(4);
    view.maxEmptyScrollsValue.setText("5");
    view.largeColorThreshold.setProgress(5);
    view.largeColorThresholdValue.setText("0.75");
    view.largeElementThreshold.setProgress(5);
    view.largeElementThresholdValue.setText("0.75");
    view.autoLaunch.setChecked(true);
    view.detectLargeColor.setChecked(true);
    view.detectLargeElement.setChecked(true);
    view.enableCollect.setChecked(true);
    view.enableFarm.setChecked(true);
    view.enableThrowRepeated.setChecked(true);
    view.enableCollectFeeding.setChecked(true);
    view.enableFeedPikmin.setChecked(true);
    view.enableGift.setChecked(true);
    view.enableSeedlingAdv.setChecked(true);
    view.enableFruit.setChecked(true);
    view.enableSeedlingGroup.setChecked(true);
    view.enableAdventureGroup.setChecked(true);
    view.enableFeedingGroup.setChecked(true);
    view.seedlingGroupOptions.visibility = android.view.View.GONE;
    view.adventureGroupOptions.visibility = android.view.View.GONE;
    view.feedingGroupOptions.visibility = android.view.View.GONE;
    view.toggleSeedlingGroup.setText("▸");
    view.toggleAdventureGroup.setText("▸");
    view.toggleFeedingGroup.setText("▸");
    view.maxEmptyLoops.setProgress(9);
    view.maxEmptyLoopsValue.setText("10");
    settingsStore.clear();
  });

  // ── Exit button ──────────────────────────────────
  view.exitBtn.on("click", function() {
    dialogResult.choice = "exit";
    d.dismiss();
  });

  var d = dialogs.build({
    customView: view
  });

  d.on("cancel", function() {
    dialogResult.choice = "exit";
  });

  d.show();

  while (dialogResult.choice === null) {
    sleep(200);
  }

  if (dialogResult.choice === "exit") {
    return null;
  }

  return dialogResult.values;
}

module.exports = {
  showConfigDialog: showConfigDialog
};
