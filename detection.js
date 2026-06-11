/**
 * detection.js
 *
 * Multi-template matching engine supporting multiple mushroom types
 * with Non-Maximum Suppression (NMS) deduplication.
 *
 * Templates are loaded once at startup via loadAllTemplates() and
 * reused across detection cycles.  The input screen image is owned
 * by the caller and is never recycled here.
 *
 * Public API:
 *   loadAllTemplates(templateDir)     → {name, image, w, h}[]
 *   findMushrooms(screenImage, templates, config) → match[]
 *   nms(matches, overlapThreshold)    → deduplicated match[]
 *   recycleAllTemplates(templates)    → void (cleanup)
 */

"auto";

var config = require("./config");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default IoU threshold for Non-Maximum Suppression. */
var DEFAULT_NMS_THRESHOLD = 0.3;

/** Default match confidence threshold. */
var DEFAULT_MATCH_THRESHOLD = 0.85;

/**
 * Fallback search region when getGameMapRegion() is not available.
 * y=50 excludes the status bar on most devices.
 */
function _defaultRegion() {
  var statusH = config.ui.statusBarHeight;
  var navH = config.ui.navBarHeight;
  return {
    x: 0,
    y: statusH,
    w: device.width,
    h: device.height - statusH - navH,
  };
}

/**
 * Resolve the search region.
 *
 * If getGameMapRegion() is defined globally (e.g. from utils or a
 * device-specific module), it is called and its result is used.
 * Otherwise the built-in fallback region is returned.
 *
 * @returns {{x: number, y: number, w: number, h: number}}
 */
function _resolveRegion() {
  if (typeof getGameMapRegion === "function") {
    var custom = getGameMapRegion();
    if (custom && custom.x !== undefined && custom.y !== undefined &&
        custom.w !== undefined && custom.h !== undefined) {
      return custom;
    }
  }
  return _defaultRegion();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the Intersection over Union of two bounding boxes.
 *
 * Each match must carry its template dimensions (w / h) so the
 * bounding box can be computed as (x, y) → (x + w, y + h).
 *
 * @param {{x: number, y: number, width: number, height: number}} m1
 * @param {{x: number, y: number, width: number, height: number}} m2
 * @returns {number} IoU in [0.0, 1.0].
 */
function _calculateIoU(m1, m2) {
  // Match 1 bounds
  var x1_min = m1.x;
  var y1_min = m1.y;
  var x1_max = m1.x + m1.width;
  var y1_max = m1.y + m1.height;

  // Match 2 bounds
  var x2_min = m2.x;
  var y2_min = m2.y;
  var x2_max = m2.x + m2.width;
  var y2_max = m2.y + m2.height;

  // Intersection
  var xi_min = Math.max(x1_min, x2_min);
  var yi_min = Math.max(y1_min, y2_min);
  var xi_max = Math.min(x1_max, x2_max);
  var yi_max = Math.min(y1_max, y2_max);

  if (xi_min >= xi_max || yi_min >= yi_max) {
    return 0.0;
  }

  var intersection = (xi_max - xi_min) * (yi_max - yi_min);
  var area1 = m1.width * m1.height;
  var area2 = m2.width * m2.height;
  var union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0.0;
}

// ---------------------------------------------------------------------------
// _collectImageFiles  (internal — recursive file collector)
// ---------------------------------------------------------------------------

/**
 * Recursively collect image files (.png/.jpg/.jpeg) from a directory,
 * including all subdirectories.
 *
 * Template names are prefixed with their subdirectory path so the user
 * can identify which category a match came from (e.g. "mushrooms/normal.png").
 *
 * @param {string} dir - Directory to scan.
 * @param {string[]} [excludeDirs] - Optional array of subdirectory names to skip.
 * @returns {{path: string, name: string}[]}
 *   Array of {path, name} objects. name includes subdirectory prefix.
 *   Returns empty array when dir is missing or empty.
 */
function _collectImageFiles(dir, excludeDirs) {
  excludeDirs = excludeDirs || [];
  var results = [];
  var entries = [];
  try {
    entries = files.listDir(dir);
  } catch (e) {
    console.warn("_collectImageFiles: cannot list directory '" + dir + "': " + e);
    return results;
  }

  if (!entries || entries.length === 0) {
    return results;
  }

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var fullPath = files.join(dir, entry);

    if (files.isDir(fullPath)) {
      // Skip excluded directories (e.g. "navigation")
      if (excludeDirs.indexOf(entry) !== -1) {
        continue;
      }
      // Recurse into subdirectory — collected files get the category prefix
      var subResults = _collectImageFiles(fullPath, excludeDirs);
      for (var j = 0; j < subResults.length; j++) {
        subResults[j].name = entry + "/" + subResults[j].name;
        results.push(subResults[j]);
      }
    } else {
      // It's a file — check if it's an image
      var lower = entry.toLowerCase();
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        results.push({
          path: fullPath,
          name: entry
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// loadAllTemplates
// ---------------------------------------------------------------------------

/**
 * Load all template images from the given directory and its subdirectories.
 *
 * Supports organising templates in subdirectories by category:
 *   ./templates/
 *     mushrooms/normal.png
 *     pikmin/red.png
 *
 * Template names include the subdirectory prefix (e.g. "mushrooms/normal.png")
 * so you can identify which category a match came from.
 *
 * Templates should be loaded once at startup and reused across
 * detection cycles.  Call recycleAllTemplates() when done.
 *
 * @param {string} templateDir - Path to the template directory
 *   (e.g. "./templates").
 * @param {Object} [options] - Optional settings.
 * @param {string[]} [options.excludeDirs] - Subdirectory names to skip
 *   (e.g. ["navigation"]).
 * @returns {{name: string, image: Image, w: number, h: number}[]}
 *   Array of template descriptors.  Returns an empty array when the
 *   directory is missing, empty, or contains no valid image files.
 */
function loadAllTemplates(templateDir, options) {
  options = options || {};
  if (!templateDir) {
    console.warn("loadAllTemplates: templateDir is null or undefined");
    return [];
  }

  // Recursively collect all image files (optionally skip excluded dirs)
  var imageFiles = _collectImageFiles(templateDir, options.excludeDirs || []);

  if (imageFiles.length === 0) {
    console.warn("loadAllTemplates: no image files (.png/.jpg/.jpeg) found in '" +
      templateDir + "' or its subdirectories");
    return [];
  }

  var templates = [];

  for (var i = 0; i < imageFiles.length; i++) {
    var filePath = imageFiles[i].path;
    var fileName = imageFiles[i].name;

    try {
      var img = images.read(filePath);
      if (!img) {
        console.warn("loadAllTemplates: images.read() returned null for '" +
          filePath + "' — skipping");
        continue;
      }

      var w = img.getWidth();
      var h = img.getHeight();

      if (w === 0 || h === 0) {
        console.warn("loadAllTemplates: template '" + fileName +
          "' has zero dimension (" + w + "×" + h + ") — skipping");
        img.recycle();
        continue;
      }

      templates.push({
        name: fileName,
        image: img,
        w: w,
        h: h,
      });
    } catch (e) {
      console.warn("loadAllTemplates: failed to read template '" +
        filePath + "': " + e + " — skipping");
    }
  }

  console.info("loadAllTemplates: loaded " + templates.length +
    " template(s) from '" + templateDir + "'");

  return templates;
}

// ---------------------------------------------------------------------------
// findMushrooms
// ---------------------------------------------------------------------------

/**
 * Find mushrooms in a screenshot by matching against all loaded templates.
 *
 * The screen image is owned by the caller and is NOT recycled here.
 *
 * @param {Image} screenImage - AutoJS screenshot image.  NOT recycled here.
 * @param {{name: string, image: Image, w: number, h: number}[]} templates
 *   Array of template descriptors as returned by loadAllTemplates().
 *   Must contain at least one entry.
 * @param {Object} [config] - Configuration object with optional
 *   detection sub-section:
 *   @param {Object}  [config.detection]
 *   @param {number}  [config.detection.threshold=0.85]
 *     Minimum match confidence (0–1).
 *   @param {boolean} [config.detection.breakOnFirstMatch=false]
 *     When true, return immediately after the first match is found.
 * @returns {Object[]} Array of match objects, each with:
 *   x (number):         Top-left x of the match on screen.
 *   y (number):         Top-left y of the match on screen.
 *   confidence (number): Match confidence score (0–1).
 *   templateName (string): Filename of the matched template.
 *   width (number):      Template width in px.
 *   height (number):     Template height in px.
 */
function findMushrooms(screenImage, templates, config) {
  if (!screenImage) {
    console.warn("findMushrooms: screenImage is null or undefined");
    return [];
  }

  if (!templates || templates.length === 0) {
    console.warn("findMushrooms: templates array is empty");
    return [];
  }

  // Resolve config values
  var threshold = DEFAULT_MATCH_THRESHOLD;
  var breakOnFirstMatch = false;

  if (config) {
    if (config.detection) {
      if (config.detection.threshold !== undefined) {
        threshold = config.detection.threshold;
      }
      if (config.detection.breakOnFirstMatch !== undefined) {
        breakOnFirstMatch = config.detection.breakOnFirstMatch;
      }
    }
  }

  // Resolve search region
  var region = _resolveRegion();
  var regionArr = [region.x, region.y, region.w, region.h];

  var allMatches = [];

  for (var i = 0; i < templates.length; i++) {
    var tpl = templates[i];

    if (!tpl.image) {
      continue;
    }

    try {
      var match = images.findImage(screenImage, tpl.image, {
        threshold: threshold,
        region: regionArr,
      });

      if (match) {
        var result = {
          x: match.x,
          y: match.y,
          confidence: match.confidence !== undefined ? match.confidence : threshold,
          templateName: tpl.name,
          width: tpl.w,
          height: tpl.h,
        };

        if (breakOnFirstMatch) {
          console.info("findMushrooms: found '" + tpl.name +
            "' at (" + match.x + ", " + match.y +
            ") confidence=" + result.confidence.toFixed(3) +
            " — breakOnFirstMatch=true, returning early");
          return [result];
        }

        allMatches.push(result);
      }
    } catch (e) {
      console.warn("findMushrooms: error matching template '" +
        tpl.name + "': " + e);
    }
  }

  if (allMatches.length === 0) {
    return [];
  }

  // Deduplicate overlapping matches
  var deduped = nms(allMatches, DEFAULT_NMS_THRESHOLD);

  // Sort final results by confidence descending
  deduped.sort(function (a, b) {
    return b.confidence - a.confidence;
  });

  return deduped;
}

// ---------------------------------------------------------------------------
// nms — Non-Maximum Suppression
// ---------------------------------------------------------------------------

/**
 * Apply Non-Maximum Suppression to deduplicate overlapping matches.
 *
 * Matches are greedily selected: sorted by confidence descending,
 * then any match whose IoU with an already-kept match exceeds
 * overlapThreshold is discarded.
 *
 * @param {Object[]} matches - Array of match objects.  Each should have:
 *   x (number), y (number), confidence (number),
 *   width (number), height (number).
 * @param {number} [overlapThreshold=0.3] - IoU threshold above which
 *   the lower-confidence match is discarded.  Range [0.0, 1.0].
 * @returns {Object[]} Filtered matches sorted by confidence descending.
 */
function nms(matches, overlapThreshold) {
  if (!matches || matches.length === 0) {
    return [];
  }

  if (overlapThreshold === undefined || overlapThreshold === null) {
    overlapThreshold = DEFAULT_NMS_THRESHOLD;
  }

  // Sort by confidence descending
  var sorted = matches.slice().sort(function (a, b) {
    return b.confidence - a.confidence;
  });

  // Greedy selection: keep the highest-confidence match, discard
  // any others that overlap with it beyond the threshold.
  var kept = [];

  for (var i = 0; i < sorted.length; i++) {
    var candidate = sorted[i];
    var overlapping = false;

    for (var j = 0; j < kept.length; j++) {
      if (_calculateIoU(candidate, kept[j]) > overlapThreshold) {
        overlapping = true;
        break;
      }
    }

    if (!overlapping) {
      kept.push(candidate);
    }
  }

  return kept;
}

// ---------------------------------------------------------------------------
// recycleAllTemplates
// ---------------------------------------------------------------------------

/**
 * Recycle all loaded template images to free memory.
 *
 * After calling this function the templates array is set to empty;
 * the caller must reload templates via loadAllTemplates() before
 * the next detection cycle.
 *
 * @param {{name: string, image: Image, w: number, h: number}[]} templates
 *   Array of template descriptors to recycle.  Modified in-place.
 */
function recycleAllTemplates(templates) {
  if (!templates || templates.length === 0) {
    return;
  }

  var recycledCount = 0;

  for (var i = 0; i < templates.length; i++) {
    var tpl = templates[i];
    if (tpl && tpl.image) {
      try {
        tpl.image.recycle();
        recycledCount++;
      } catch (e) {
        console.warn("recycleAllTemplates: failed to recycle '" +
          tpl.name + "': " + e);
      }
      tpl.image = null;
    }
  }

  console.info("recycleAllTemplates: recycled " + recycledCount +
    " of " + templates.length + " template(s)");

  // Clear the array
  templates.length = 0;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadAllTemplates: loadAllTemplates,
  findMushrooms: findMushrooms,
  nms: nms,
  recycleAllTemplates: recycleAllTemplates,
};
