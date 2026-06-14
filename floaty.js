/**
 * floaty.js
 *
 * Minimal floating log panel for Pikmin Bloom Mushroom Finder.
 * Transparent background, red log text, scrollable,
 * draggable via title bar, close button on top-right.
 *
 * The panel is hidden off-screen during the scan loop so it never
 * interferes with screen capture or image detection.
 *
 * Exports:
 *   createControlPanel(fn) - Create and return the panel
 *   updateStatus(w, text)  - No-op (kept for call-site compatibility)
 *   appendLog(w, message)  - Append a timestamped line
 *   setButtonText(w, text) - No-op
 *   setButtonCallback(...) - No-op
 *   setCloseCallback(w, fn)- Wire close-button handler
 *   showDuringScan(w, show)- Hide/restore during scanning
 *   destroy(w)             - Close the panel
 */

/**
 * Create the minimal floating log panel.
 *
 * No background — transparent, red log text, scrollable.
 * Close button on the top-right; drag via the title bar.
 *
 * @param {Function} [closeCallback] - Called when × is tapped
 *
 * @returns {Object} The floaty raw window object
 */
function createControlPanel(closeCallback) {
  var w = floaty.rawWindow(
    <vertical w="300dp">
      <horizontal id="titleBar" gravity="center_vertical">
        <text layout_weight="1" />
        <text id="closeBtn" text="×" textColor="#FF6666" textSize="18sp"
              w="28dp" h="28dp" gravity="center" />
      </horizontal>
      <scroll id="logScroll" w="*" h="70dp">
        <text id="logArea" text="" textColor="#FF5555" textSize="10sp"
              padding="4" lineSpacingExtra="2sp" clickable="false"
              focusable="false" />
      </scroll>
    </vertical>
  );

  w.setPosition(20, 80);
  w.setTouchable(true);

  // ── Drag support ──────────────────────────────────────────────────────
  // Touch-and-drag on the title bar (including close button) to reposition.
  var winX = 20;
  var winY = 80;
  var startX = 0;
  var startY = 0;
  var dragging = false;

  w.titleBar.setOnTouchListener(function(view, event) {
    switch (event.getAction()) {
      case event.ACTION_DOWN:
        startX = event.getRawX();
        startY = event.getRawY();
        winX = w.getX();
        winY = w.getY();
        dragging = false;
        return true;
      case event.ACTION_MOVE:
        var dx = event.getRawX() - startX;
        var dy = event.getRawY() - startY;
        if (!dragging) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return true;
          dragging = true;
        }
        w.setPosition(winX + dx, winY + dy);
        return true;
      case event.ACTION_UP:
        dragging = false;
        return true;
    }
    return true;
  });

  // ── Close button ──────────────────────────────────────────────────────
  w.closeBtn.click(function() {
    if (closeCallback) {
      closeCallback();
    } else {
      w.close();
    }
  });

  return w;
}

/**
 * Update the status text — no-op since the panel no longer has a
 * status line.  Kept for call-site compatibility.
 *
 * @param {Object} w    - The control panel window
 * @param {string} text - Ignored
 */
function updateStatus(w, text) {
  // No status line in the minimal panel — nothing to do.
}

/**
 * Append a timestamped log line to the log area.
 * Keeps at most ~500 characters (scrolling history).
 * Also prints to console.info so the VSCode plugin sees the same log.
 *
 * @param {Object} w       - The control panel window
 * @param {string} message - Log message to append
 */
function appendLog(w, message) {
  if (!w || !w.logArea) return;
  console.info(message);
  ui.run(function() {
    var timestamp = new Date();
    var timeStr =
      ("0" + timestamp.getHours()).slice(-2) + ":" +
      ("0" + timestamp.getMinutes()).slice(-2) + ":" +
      ("0" + timestamp.getSeconds()).slice(-2);
    var line = "[" + timeStr + "] " + message;
    var current = w.logArea.text();
    var updated = current ? current + "\n" + line : line;
    if (updated.length > 500) {
      updated = updated.slice(-500);
    }
    w.logArea.setText(updated);
  });
}

/**
 * No-op — panel no longer has a button.
 *
 * @param {Object} w    - Ignored
 * @param {string} text - Ignored
 */
function setButtonText(w, text) {
  // No button in the minimal panel.
}

/**
 * No-op — panel no longer has a button.
 *
 * @param {Object}   w        - Ignored
 * @param {Function} callback - Ignored
 */
function setButtonCallback(w, callback) {
  // No button in the minimal panel.
}

/**
 * Set the handler for the close (×) button.
 *
 * @param {Object}   w        - The control panel window
 * @param {Function} callback - Function to call when × is tapped
 */
function setCloseCallback(w, callback) {
  if (!w || !w.closeBtn) return;
  w.closeBtn.click(function() {
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
    w.setPosition(20, 80);
  }
}

/**
 * Close and destroy the control panel.
 *
 * @param {Object} w - The control panel window to close
 */
function destroy(w) {
  if (!w) return;
  try {
    w.close();
  } catch (e) {
    // Ignore — window may already be closed
  }
}

module.exports = {
  createControlPanel: createControlPanel,
  updateStatus: updateStatus,
  appendLog: appendLog,
  setButtonText: setButtonText,
  setButtonCallback: setButtonCallback,
  setCloseCallback: setCloseCallback,
  showDuringScan: showDuringScan,
  destroy: destroy
};
