/**
 * lib/screen.js — Image capture, brightness, and terrain analysis utilities
 *
 * Public API:
 *   saveScreenshotToGallery(image, name?) → path or null
 *   meanBrightness(image)                 → number [0..255]
 *   terrainRatio(image)                   → number [0..1]
 *
 * NOTES
 * - All pixel analysis uses stride-based sampling (every 10th pixel)
 *   for performance — never scans every pixel.
 * - The caller is responsible for recycling Image objects passed in.
 */

"auto";

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
  saveScreenshotToGallery: saveScreenshotToGallery,
  meanBrightness: meanBrightness,
  terrainRatio: terrainRatio,
};
