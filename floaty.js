/**
 * floaty.js
 *
 * Persistent floating control panel for Pikmin Bloom Mushroom Finder.
 * Provides status display, scrolling log, and Start/Stop button.
 *
 * The panel auto-hides during swipe gestures (via showDuringScan)
 * to avoid blocking game touches. Positioned at the top-right edge
 * where the game map has minimal interactive elements.
 *
 * Exports:
 *   createControlPanel()     - Create and return the control panel window
 *   updateStatus(w, text)    - Update the status text
 *   appendLog(w, message)    - Append a timestamped line to the log area
 *   setButtonText(w, text)   - Change the control button label
 *   setButtonCallback(w, fn) - Set the control button click handler
 *   showDuringScan(w, show)  - Hide/restore during scanning
 *   destroy(w)               - Close the panel
 */

var config = require("./config");

/**
 * Create the persistent control panel.
 *
 * Layout: 220px wide, positioned top-right.
 * Contains title, status, scrollable log area, and control button.
 *
 * @returns {Object} The floaty raw window object
 */
function createControlPanel() {
  var w = floaty.rawWindow(
    <vertical padding="4" bg="#DD000000" w="220px">
      <text text="Mushroom Finder" textColor="#1976D2" textSize="14sp"
            gravity="center" margin="0 2 4 2"/>
      <text id="status" text="Tap Start to begin" textColor="white"
            textSize="11sp" gravity="center" margin="0 0 4 0"/>
      <frame h="90px" bg="#33000000" margin="0 0 4 0">
        <text id="logArea" text="" textColor="#AAFFAA" textSize="9sp"
              padding="2" maxLines="5"/>
      </frame>
      <horizontal gravity="center" margin="0 0 4 0">
        <text text="Settle:" textColor="#AAAAAA" textSize="10sp"
              gravity="center" margin="0 0 2 0"/>
        <button id="settleMinus" text="−" textSize="14sp" textColor="white"
                bg="#555555" w="30px" h="28px" margin="2 0 2 0"/>
        <text id="settleValue" text="2500ms" textColor="white" textSize="10sp"
              w="55px" gravity="center"/>
        <button id="settlePlus" text="+" textSize="14sp" textColor="white"
                bg="#555555" w="30px" h="28px" margin="2 0 0 0"/>
      </horizontal>
      <button id="ctrlBtn" text="Start Scan" textSize="13sp" textColor="white"
              bg="#4CAF50" h="38px" margin="0 0 2 0"/>
    </vertical>
  );

  w.setPosition(device.width - 240, 80);
  w.setSize(220, 230);
  w.setTouchable(true);

  w.settleMinus.click(function() {
    config.scan.settleDelay = Math.max(
      config.scan.settleDelayMin,
      config.scan.settleDelay - config.scan.settleDelayStep
    );
    ui.run(function() {
      w.settleValue.setText(config.scan.settleDelay + "ms");
    });
  });

  w.settlePlus.click(function() {
    config.scan.settleDelay = Math.min(
      config.scan.settleDelayMax,
      config.scan.settleDelay + config.scan.settleDelayStep
    );
    ui.run(function() {
      w.settleValue.setText(config.scan.settleDelay + "ms");
    });
  });

  return w;
}

/**
 * Update the status text on the control panel.
 *
 * @param {Object} w    - The control panel window
 * @param {string} text - New status text
 */
function updateStatus(w, text) {
  if (!w || !w.status) return;
  ui.run(function() {
    w.status.setText(text);
  });
}

/**
 * Append a timestamped log line to the log area.
 * Keeps at most ~500 characters (scrolling history).
 *
 * @param {Object} w       - The control panel window
 * @param {string} message - Log message to append
 */
function appendLog(w, message) {
  if (!w || !w.logArea) return;
  ui.run(function() {
    var timestamp = new Date();
    var timeStr =
      ("0" + timestamp.getHours()).slice(-2) + ":" +
      ("0" + timestamp.getMinutes()).slice(-2) + ":" +
      ("0" + timestamp.getSeconds()).slice(-2);
    var line = "[" + timeStr + "] " + message;
    var current = w.logArea.text();
    var updated = current ? current + "\n" + line : line;
    // Keep only the last ~500 characters
    if (updated.length > 500) {
      updated = updated.slice(-500);
    }
    w.logArea.setText(updated);
  });
}

/**
 * Change the control button label (e.g. "Start" vs "Stop").
 *
 * @param {Object} w    - The control panel window
 * @param {string} text - New button text
 */
function setButtonText(w, text) {
  if (!w || !w.ctrlBtn) return;
  ui.run(function() {
    w.ctrlBtn.setText(text);
  });
}

/**
 * Set the click handler for the control button.
 * Call this once during setup to wire up Start/Stop logic.
 *
 * @param {Object}   w        - The control panel window
 * @param {Function} callback - Function to call on button click
 */
function setButtonCallback(w, callback) {
  if (!w || !w.ctrlBtn) return;
  w.ctrlBtn.click(function() {
    callback();
  });
}

/**
 * Temporarily hide the panel during scan swipes, or restore it.
 *
 * @param {Object} w    - The control panel window
 * @param {boolean} show - true = restore, false = hide
 */
function showDuringScan(w, show) {
  if (!w) return;
  if (show === false) {
    w.setPosition(-999, -999);
  } else {
    w.setPosition(device.width - 240, 80);
  }
}

/**
 * Close and destroy the control panel.
 *
 * @param {Object} w - The control panel window to close
 */
function destroy(w) {
  if (!w) return;
  w.close();
}

module.exports = {
  createControlPanel: createControlPanel,
  updateStatus: updateStatus,
  appendLog: appendLog,
  setButtonText: setButtonText,
  setButtonCallback: setButtonCallback,
  showDuringScan: showDuringScan,
  destroy: destroy
};
