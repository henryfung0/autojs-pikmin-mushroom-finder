/**
 * PikminBloomMushroomFinder — Centralized Configuration
 * ======================================================
 * All user-tunable parameters for the AutoJS Pikmin Bloom
 * mushroom scanning / detection pipeline.
 *
 * Usage:
 *   const config = require('./ui/config');
 *   config.scan.swipeDuration   // => 600
 *
 * @module config
 */

var config = {
  // ──────────────────────────────────────────────
  // App Settings
  // ──────────────────────────────────────────────
  /** @namespace app - Application launch & navigation timeouts. */
  app: {
    /**
     * Android application package name.
     * Used to launch / bring-to-foreground the target app.
     * @type {string}
     * @default "com.nianticlabs.pikmin"
     */
    packageName: 'com.nianticlabs.pikmin',

    /**
     * Maximum time (ms) to wait for the app to launch or come to the foreground.
     * @type {number}
     * @default 30000
     * @unit milliseconds
     */
    launchTimeout: 30000,

    /**
     * Maximum time (ms) to wait for a map / scene transition animation to finish.
     * @type {number}
     * @default 15000
     * @unit milliseconds
     */
    mapTransitionTimeout: 15000,
  },

  // ──────────────────────────────────────────────
  // Scan Settings
  // ──────────────────────────────────────────────
  /** @namespace scan - Swipe / pan parameters for covering the in-game map. */
  scan: {
    /**
     * Delay (ms) after each swipe action to let the map settle / render.
     * @type {number}
     * @default 2500
     * @unit milliseconds
     */
    settleDelay: 2500,
    /** @private Minimum settle delay (500 ms). */
    settleDelayMin: 500,
    /** @private Maximum settle delay (10 000 ms). */
    settleDelayMax: 10000,
    /** @private Step size for panel +/- buttons (250 ms). */
    settleDelayStep: 250,

    /**
     * Duration (ms) of each swipe gesture.
     * Must stay under 2000 ms to keep scan speed reasonable.
     * @type {number}
     * @default 600
     * @unit milliseconds
     */
    swipeDuration: 600,

    /**
     * Fractional overlap between adjacent swipes (0.0 – 1.0).
     * 0.4 means each swipe covers 40 % of the previous swipe's area,
     * ensuring no mushrooms are missed between passes.
     * @type {number}
     * @default 0.4
     * @unit fraction (0–1)
     */
    overlapPercent: 0.4,

    /**
     * Vertical shift as a fraction of screen height per horizontal scan row.
     * 0.6 means each new row starts 60 % of the screen height lower.
     * @type {number}
     * @default 0.6
     * @unit fraction of screen height
     */
    verticalShiftPercent: 0.6,

    /**
     * Maximum consecutive empty scrolls before repositioning the map.
     * When no "others" templates (seeds, decor) match for this many
     * consecutive captures, the scanner clicks the player's own position
     * to re-center the map and continues scanning.
     * @type {number}
     * @default 5
     * @unit count (1–15)
     */
    maxEmptyScrolls: 5,
  },

  // ──────────────────────────────────────────────
  // Detection Settings
  // ──────────────────────────────────────────────
  /** @namespace detection - Template-matching and Non-Maximum Suppression parameters. */
  detection: {
    /**
     * Minimum confidence threshold for template matching (0.0 – 1.0).
     * Lower values detect more candidates but increase false positives.
     * @type {number}
     * @default 0.85
     * @unit confidence (0–1)
     */
    threshold: 0.85,

    /**
     * Maximum number of match candidates kept after Non-Maximum Suppression.
     * @type {number}
     * @default 5
     * @unit count
     */
    maxMatches: 5,

    /**
     * Intersection-over-Union threshold used by NMS to de-duplicate overlapping
     * detections. Two boxes with IoU > this value are considered the same target.
     * @type {number}
     * @default 0.3
     * @unit IoU (0–1)
     */
    nmsOverlap: 0.3,

    /**
     * If true, stop scanning as soon as the first valid match is found.
     * Saves CPU time when you only need to confirm at least one mushroom exists.
     * @type {boolean}
     * @default true
     */
    breakOnFirstMatch: true,

    /**
     * Directory (relative to script root) where template images (*.png) are stored.
     * Co-located with the code so the entire mushroom-finder is portable.
     * @type {string}
     * @default "./templates/"
     */
    templateDir: './templates/',

    /**
     * Whether to include "large color" mushroom templates in the scan.
     * Set to false to only scan for "large element" mushrooms.
     * @type {boolean}
     * @default true
     */
    detectLargeColor: true,

    /**
     * Whether to include "large element" mushroom templates in the scan.
     * Set to false to only scan for "large color" mushrooms.
     * @type {boolean}
     * @default true
     */
    detectLargeElement: true,

    /**
     * File extensions to scan for when loading template images.
     * Supports PNG and JPEG formats.
     * @type {string}
     * @default "*.png, *.jpg, *.jpeg"
     */
    templatePattern: '*.png, *.jpg, *.jpeg',
  },

  // ──────────────────────────────────────────────
  // Advanture Settings
  // ──────────────────────────────────────────────
  /** @namespace advanture - Item collection preferences for advanture mode. */
  advanture: {
    enableGift: true,
    enablePlant: true,
    enableFruit: true,

    /**
     * Whether to auto-collect seedlings when entering the seedling page.
     * When enabled, looks for "Collect seedlings.jpg" and performs
     * the tap-hold + pull-up + confirm sequence.
     * @type {boolean}
     * @default true
     */
    enableCollect: true,

    /**
     * Whether to auto-farm seedlings when on seedling page 1.
     * When enabled, looks for "Empty space.jpg" and clicks through
     * special → Special seedlings → Confirm seedlings.
     * @type {boolean}
     * @default true
     */
    enableFarm: true,

    /**
     * Whether to auto-throw repeated seedlings from the seedling page.
     * When enabled, scans for throw items and performs the throw flow.
     * @type {boolean}
     * @default true
     */
    enableThrowRepeated: true,

    /**
     * Maximum consecutive empty scan loops before giving up and returning
     * to the main page.  When no fruit / gift / plant is found for this
     * many loops in a row, the advanture scan exits gracefully.
     * @type {number}
     * @default 10
     * @unit count (1–30)
     */
    maxEmptyLoops: 10,
  },

  // ──────────────────────────────────────────────
  // UI Constants
  // ──────────────────────────────────────────────
  /** @namespace ui - Known system-bar heights used to offset touch coordinates. */
  ui: {
    /**
     * Height (px) of the Android status bar (notification bar) at the top.
     * Used to compute safe touchable screen bounds.
     * @type {number}
     * @default 50
     * @unit pixels
     */
    statusBarHeight: 50,

    /**
     * Height (px) of the Android navigation bar (gesture / 3-button) at the bottom.
     * Used to compute safe touchable screen bounds.
     * @type {number}
     * @default 60
     * @unit pixels
     */
    navBarHeight: 60,
  },

  // ──────────────────────────────────────────────
  // Screenshot Settings
  // ──────────────────────────────────────────────
  /** @namespace screenshot - Output paths for captured screenshots. */
  screenshot: {
    /**
     * Directory where annotated / debug screenshots are saved.
     * Must be on a path writable by AutoJS (typically /sdcard/DCIM/…).
     * @type {string}
     * @default "/sdcard/DCIM/PikminMushroomFinder/"
     */
    outputDir: '/sdcard/DCIM/PikminMushroomFinder/',
  },

  // ──────────────────────────────────────────────
  // Debug Settings
  // ──────────────────────────────────────────────
  /** @namespace debug - Logging and diagnostic controls. */
  debug: {
    /**
     * Master switch for debug output.
     * When false, suppresses verbose logging and extra screenshot saves.
     * @type {boolean}
     * @default false
     */
    enabled: false,

    /**
     * When true, log messages are also displayed on a floating overlay window
     * (AutoJS Floaty) for real-time visibility without ADB.
     * @type {boolean}
     * @default true
     */
    logToFloaty: true,
  },
};

module.exports = config;
