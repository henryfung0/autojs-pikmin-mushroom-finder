/**
 * mushroom_finder/screen_state.js — Pikmin Bloom screen state classification
 *
 * Public API:
 *   classifyScreenState(image, options?)  → "loading"|"map_visible"|"error"|"unknown"
 *   getGameMapRegion(options?)            → {x, y, w, h}
 *
 * NOTES
 * - All pixel analysis uses stride-based sampling (every 10th pixel)
 *   for performance — never scans every pixel.
 * - Thresholds use default parameters with fallback values so that
 *   config.js can be imported without creating circular dependencies.
 * - The caller is responsible for recycling Image objects passed in.
 */

"auto";

var { meanBrightness, terrainRatio } = require("../lib/screen");

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract red channel from an ARGB colour int.
 * @param {number} color - ARGB pixel value.
 * @returns {number} Red component [0..255].
 */
function _red(color) {
  return (color >> 16) & 0xFF;
}

// ---------------------------------------------------------------------------
// _brightRegionStats  (internal — used by classifyScreenState)
// ---------------------------------------------------------------------------

/**
 * Analyse bright, high-contrast regions in an image — a heuristic for
 * error dialogs that pop over the game map.
 *
 * @param {Image} image - AutoJs6 colour image (not recycled here).
 * @param {number} [stride=10] - Sampling interval.
 * @param {number} [brightThreshold=200] - Pixel value considered "bright".
 * @returns {{brightRatio: number, std: number}}
 *   brightRatio — fraction of sampled pixels that are bright.
 *   std        — standard deviation of grayscale pixel values.
 */
function _brightRegionStats(image, stride, brightThreshold) {
  stride = stride || 10;
  brightThreshold = brightThreshold || 200;

  var gray = images.grayscale(image);
  var w = gray.getWidth();
  var h = gray.getHeight();
  var brightCount = 0;
  var totalCount = 0;
  var values = [];

  try {
    for (var y = 0; y < h; y += stride) {
      for (var x = 0; x < w; x += stride) {
        // In a grayscale image, any colour channel gives the same value.
        var val = _red(images.pixel(gray, x, y));
        values.push(val);
        if (val >= brightThreshold) {
          brightCount++;
        }
        totalCount++;
      }
    }
  } finally {
    gray.recycle();
  }

  var brightRatio = totalCount > 0 ? brightCount / totalCount : 0;

  // Standard deviation of brightness values
  var sum = 0;
  for (var i = 0; i < values.length; i++) {
    sum += values[i];
  }
  var mean = values.length > 0 ? sum / values.length : 0;

  var sumSqDiff = 0;
  for (var i = 0; i < values.length; i++) {
    var diff = values[i] - mean;
    sumSqDiff += diff * diff;
  }
  var std = values.length > 0 ? Math.sqrt(sumSqDiff / values.length) : 0;

  return { brightRatio: brightRatio, std: std };
}

// ---------------------------------------------------------------------------
// classifyScreenState
// ---------------------------------------------------------------------------

/**
 * Classify what the game screen is currently showing based on pixel-level
 * heuristics.
 *
 * Classification order:
 *   1. **loading** — mean brightness is very low (dark screen).
 *   2. **map_visible** — significant green/blue terrain detected.
 *   3. **error** — bright, high-contrast region (e.g. dialog overlay).
 *   4. **unknown** — none of the above (or null/empty input).
 *
 * All thresholds accept `options` overrides so callers can inject values
 * from config.js without creating a circular dependency.
 *
 * @param {Image|null} image - Screenshot (AutoJs6 Image). Caller owns
 *     lifecycle (recycle).
 * @param {Object}     [options] - Threshold overrides.
 * @param {number}     [options.loadingBrightnessThreshold=50]
 * @param {number}     [options.mapGreenBlueRatio=0.15]
 * @param {number}     [options.errorBrightThreshold=200]
 * @param {number}     [options.errorBrightRegionRatio=0.10]
 * @param {number}     [options.errorContrastThreshold=60]
 * @param {number}     [options.stride=10]
 * @param {boolean}    [options.debug=false]
 * @returns {string} "loading" | "map_visible" | "error" | "unknown"
 */
function classifyScreenState(image, options) {
  if (!image) {
    if (options && options.debug) {
      console.info('classifyScreenState: null image → unknown');
    }
    return 'unknown';
  }

  var w = image.getWidth();
  var h = image.getHeight();
  if (w === 0 || h === 0) {
    if (options && options.debug) {
      console.info('classifyScreenState: empty image (0x0) → unknown');
    }
    return 'unknown';
  }

  // Merge options with fallback defaults
  var opts = options || {};
  var loadingThreshold = opts.hasOwnProperty('loadingBrightnessThreshold')
    ? opts.loadingBrightnessThreshold
    : 50;
  var mapRatio = opts.hasOwnProperty('mapGreenBlueRatio')
    ? opts.mapGreenBlueRatio
    : 0.15;
  var errBrightThreshold = opts.hasOwnProperty('errorBrightThreshold')
    ? opts.errorBrightThreshold
    : 200;
  var errBrightRatio = opts.hasOwnProperty('errorBrightRegionRatio')
    ? opts.errorBrightRegionRatio
    : 0.10;
  var errContrast = opts.hasOwnProperty('errorContrastThreshold')
    ? opts.errorContrastThreshold
    : 60;
  var stride = opts.stride || 10;
  var debug = opts.debug || false;

  // ---- Check 1: Loading screen (mostly dark) --------------------------------
  var brightness = meanBrightness(image, stride);
  if (brightness < loadingThreshold) {
    if (debug) {
      console.info(
        'classifyScreenState: loading (meanBrightness=' +
          brightness.toFixed(1) +
          ' < ' + loadingThreshold + ')'
      );
    }
    return 'loading';
  }

  // ---- Check 2: Map visible (green/blue terrain) ----------------------------
  var tRatio = terrainRatio(image, stride);
  if (tRatio > mapRatio) {
    if (debug) {
      console.info(
        'classifyScreenState: map_visible (terrainRatio=' +
          tRatio.toFixed(3) +
          ' > ' + mapRatio + ')'
      );
    }
    return 'map_visible';
  }

  // ---- Check 3: Error dialog (bright, high-contrast region) -----------------
  var stats = _brightRegionStats(image, stride, errBrightThreshold);
  if (stats.brightRatio > errBrightRatio && stats.std > errContrast) {
    if (debug) {
      console.info(
        'classifyScreenState: error (brightRatio=' +
          stats.brightRatio.toFixed(3) +
          ', std=' + stats.std.toFixed(1) +
          ')'
      );
    }
    return 'error';
  }

  // ---- Default --------------------------------------------------------------
  if (debug) {
    console.info(
      'classifyScreenState: unknown (brightness=' +
        brightness.toFixed(1) +
        ', terrainRatio=' + tRatio.toFixed(3) +
        ')'
    );
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// getGameMapRegion
// ---------------------------------------------------------------------------

/**
 * Return the game map region excluding the system status bar (top) and
 * navigation bar (bottom).
 *
 * All dimensions are computed dynamically from `device.width` and
 * `device.height` at runtime — no hardcoded pixel values.
 *
 * @param {Object}  [options] - Region / bar-height overrides.
 * @param {number}  [options.statusBarHeight=50] - Status bar height in px.
 * @param {number}  [options.navBarHeight=60]   - Navigation bar height in px.
 * @returns {{x: number, y: number, w: number, h: number}}
 *   Region that excludes system bars.
 */
function getGameMapRegion(options) {
  var opts = options || {};
  var statusBarH = opts.hasOwnProperty('statusBarHeight')
    ? opts.statusBarHeight
    : 50;
  var navBarH = opts.hasOwnProperty('navBarHeight')
    ? opts.navBarHeight
    : 60;

  // Use runtime device dimensions — never hardcode.
  var screenW = device.width;
  var screenH = device.height;

  return {
    x: 0,
    y: statusBarH,
    w: screenW,
    h: screenH - statusBarH - navBarH,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  classifyScreenState: classifyScreenState,
  getGameMapRegion: getGameMapRegion,
};
