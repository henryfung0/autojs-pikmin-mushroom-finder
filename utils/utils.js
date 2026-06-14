/**
 * utils.js
 *
 * Screen state classification, ROI (region-of-interest) calculation,
 * and image save utilities for the Pikmin Bloom Mushroom Finder.
 *
 * Public API:
 *   classifyScreenState(image, options?)  → "loading"|"map_visible"|"error"|"unknown"
 *   getGameMapRegion(options?)            → {x, y, w, h}
 *   saveScreenshotToGallery(image, name?) → path or null
 *   meanBrightness(image)                 → number [0..255]
 *   terrainRatio(image)                   → number [0..1]
 *
 * NOTES
 * - All pixel analysis uses stride-based sampling (every 10th pixel)
 *   for performance — never scans every pixel.
 * - Thresholds use default parameters with fallback values so that
 *   config.js can be imported without creating circular dependencies.
 * - The caller is responsible for recycling Image objects passed in.
 */

// ---------------------------------------------------------------------------
// Internal helpers (sampling-based pixel analysis)
// ---------------------------------------------------------------------------

/**
 * Extract red channel from an ARGB colour int.
 * @param {number} color - ARGB pixel value.
 * @returns {number} Red component [0..255].
 */
function _red(color) {
  return (color >> 16) & 0xFF;
}

/**
 * Extract green channel from an ARGB colour int.
 * @param {number} color - ARGB pixel value.
 * @returns {number} Green component [0..255].
 */
function _green(color) {
  return (color >> 8) & 0xFF;
}

/**
 * Extract blue channel from an ARGB colour int.
 * @param {number} color - ARGB pixel value.
 * @returns {number} Blue component [0..255].
 */
function _blue(color) {
  return color & 0xFF;
}

// ---------------------------------------------------------------------------
// meanBrightness
// ---------------------------------------------------------------------------

/**
 * Compute the mean pixel luminance of an image using stride-based sampling.
 *
 * Samples every `stride`-th pixel (default 10) and computes an approximate
 * perceived luminance: 0.299*R + 0.587*G + 0.114*B.
 *
 * @param {Image|null} image - AutoJs6 Image object (not recycled here).
 * @param {number}      [stride=10] - Sampling interval (every Nth pixel).
 * @returns {number} Mean luminance in [0..255]. Returns 0 for null/empty.
 */
function meanBrightness(image, stride) {
  if (!image) {
    return 0;
  }

  var w = image.getWidth();
  var h = image.getHeight();
  if (w === 0 || h === 0) {
    return 0;
  }

  stride = stride || 10;
  var totalLum = 0;
  var count = 0;

  for (var y = 0; y < h; y += stride) {
    for (var x = 0; x < w; x += stride) {
      var pixel = images.pixel(image, x, y);
      var r = _red(pixel);
      var g = _green(pixel);
      var b = _blue(pixel);
      // Perceived luminance (ITU-R BT.601)
      totalLum += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
  }

  return count > 0 ? totalLum / count : 0;
}

// ---------------------------------------------------------------------------
// terrainRatio
// ---------------------------------------------------------------------------

/**
 * Estimate the proportion of "terrain" pixels (green/blue dominant) in an
 * image — a heuristic for whether the Pikmin Bloom game map is visible.
 *
 * A pixel is counted as terrain if either:
 *   - Green is significantly higher than both Red and Blue
 *     (G > R + 10 && G > B + 10)
 *   - Blue is significantly higher than both Red and Green
 *     (B > R + 10 && B > G + 10)
 *
 * @param {Image|null} image - AutoJs6 Image object (not recycled here).
 * @param {number}      [stride=10] - Sampling interval.
 * @returns {number} Ratio [0..1]. Returns 0 for null/empty.
 */
function terrainRatio(image, stride) {
  if (!image) {
    return 0;
  }

  var w = image.getWidth();
  var h = image.getHeight();
  if (w === 0 || h === 0) {
    return 0;
  }

  stride = stride || 10;
  var terrainCount = 0;
  var totalCount = 0;

  for (var y = 0; y < h; y += stride) {
    for (var x = 0; x < w; x += stride) {
      var pixel = images.pixel(image, x, y);
      var r = _red(pixel);
      var g = _green(pixel);
      var b = _blue(pixel);

      // Green-dominant: G significantly > R and > B
      if (g > r + 10 && g > b + 10) {
        terrainCount++;
      // Blue-dominant: B significantly > R and > G
      } else if (b > r + 10 && b > g + 10) {
        terrainCount++;
      }
      totalCount++;
    }
  }

  return totalCount > 0 ? terrainCount / totalCount : 0;
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
// saveScreenshotToGallery
// ---------------------------------------------------------------------------

/**
 * Save an image to the device gallery and trigger MediaScanner so it shows
 * up in Photos / Gallery apps immediately.
 *
 * @param {Image}  image    - AutoJs6 Image to save (not recycled here).
 * @param {string} [name]   - Base filename (without extension). If omitted,
 *     a timestamp-based name "mushroom_found_YYYYMMDD_HHmmss" is generated.
 * @param {Object} [options] - Save options.
 * @param {string} [options.outputDir="/sdcard/DCIM/PikminMushroomFinder/"]
 *     Directory to save into. Created automatically if missing.
 * @returns {string|null} Absolute path to the saved file, or null on failure.
 */
function saveScreenshotToGallery(image, name, options) {
  if (!image) {
    console.warn('saveScreenshotToGallery: image is null');
    return null;
  }

  var opts = options || {};
  var outputDir = opts.outputDir || '/sdcard/DCIM/PikminMushroomFinder/';

  // Generate timestamp filename
  var now = new Date();
  var ts =
    now.getFullYear() +
    ('0' + (now.getMonth() + 1)).slice(-2) +
    ('0' + now.getDate()).slice(-2) +
    '_' +
    ('0' + now.getHours()).slice(-2) +
    ('0' + now.getMinutes()).slice(-2) +
    ('0' + now.getSeconds()).slice(-2);

  var baseName = name || 'mushroom_found_' + ts;
  // Sanitise: only alphanumeric, dash, underscore
  baseName = String(baseName).replace(/[^a-zA-Z0-9\-_]/g, '_');
  var filename = baseName + '.png';
  var filepath = files.join(outputDir, filename);

  // Ensure output directory exists
  try {
    files.ensureDir(outputDir);
  } catch (e) {
    console.warn('saveScreenshotToGallery: files.ensureDir failed: ' + e);
    // Fallback: shell mkdir
    try {
      var result = shell('mkdir -p "' + outputDir + '"', true);
      if (!result || result.code !== 0) {
        console.error('saveScreenshotToGallery: shell mkdir also failed');
        return null;
      }
    } catch (e2) {
      console.error('saveScreenshotToGallery: shell mkdir exception: ' + e2);
      return null;
    }
  }

  // Save image to disk
  try {
    images.save(image, filepath, 'png', 100);
    console.info('Screenshot saved: ' + filepath);
  } catch (e) {
    console.error('saveScreenshotToGallery: images.save failed: ' + e);
    return null;
  }

  // Trigger MediaScanner so the file appears in the device gallery
  try {
    MediaScannerConnection.scanFile(
      context,
      [filepath],
      ['image/png'],
      null
    );
    if (typeof shell !== 'undefined') {
      // Alternative broadcast for older Android / non-AutoJs6 MediaScanner
      shell('am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://' + filepath + '"', true);
    }
  } catch (e) {
    // MediaScanner is best-effort — file is saved even if scan fails
    console.warn('saveScreenshotToGallery: MediaScanner warning: ' + e);
  }

  return filepath;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  classifyScreenState: classifyScreenState,
  getGameMapRegion: getGameMapRegion,
  saveScreenshotToGallery: saveScreenshotToGallery,
  meanBrightness: meanBrightness,
  terrainRatio: terrainRatio,
};
