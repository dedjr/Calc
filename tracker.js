/**
 * DEBATRE Analytics Tracker
 * Lightweight client-side tracking for visitor analytics
 */

(function() {
  'use strict';

  // Configuration
  const API_BASE = '/api/analytics';
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const BATCH_INTERVAL = 10 * 1000; // 10 seconds
  const MAX_BATCH_SIZE = 50;

  // Session management
  let sessionId = null;
  let sessionStartTime = null;
  let isSessionActive = false;
  let eventQueue = [];
  let batchTimer = null;
  let sessionEndTimer = null;
  let pageLoadTime = performance.now();

  /**
   * Generate a unique session ID
   */
  function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Hash IP address (done on server, but we'll use a placeholder)
   */
  function getClientFingerprint() {
    const ua = navigator.userAgent;
    const screen = window.screen;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${ua}|${screen.width}x${screen.height}|${tz}`;
  }

  /**
   * Parse user agent to extract device, OS, and browser info
   */
  function parseUserAgent(ua) {
    const result = {
      deviceType: 'desktop',
      os: 'unknown',
      browser: 'unknown',
      browserVersion: 'unknown'
    };

    // Detect mobile/tablet
    if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      result.deviceType = 'mobile';
    }
    if (/ipad|android(?!.*mobi)/i.test(ua)) {
      result.deviceType = 'tablet';
    }

    // Detect OS
    if (/win/i.test(ua)) result.os = 'Windows';
    else if (/mac/i.test(ua)) result.os = 'macOS';
    else if (/linux/i.test(ua)) result.os = 'Linux';
    else if (/android/i.test(ua)) result.os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) result.os = 'iOS';

    // Detect browser
    if (/chrome|chromium/i.test(ua)) {
      result.browser = 'Chrome';
      const match = ua.match(/Chrome\/([0-9.]+)/);
      if (match) result.browserVersion = match[1];
    } else if (/safari/i.test(ua)) {
      result.browser = 'Safari';
      const match = ua.match(/Version\/([0-9.]+)/);
      if (match) result.browserVersion = match[1];
    } else if (/firefox/i.test(ua)) {
      result.browser = 'Firefox';
      const match = ua.match(/Firefox\/([0-9.]+)/);
      if (match) result.browserVersion = match[1];
    } else if (/edge/i.test(ua)) {
      result.browser = 'Edge';
      const match = ua.match(/Edge\/([0-9.]+)/);
      if (match) result.browserVersion = match[1];
    }

    return result;
  }

  /**
   * Initialize session
   */
  function initSession() {
    if (sessionId) return;

    sessionId = generateSessionId();
    sessionStartTime = new Date().toISOString();
    isSessionActive = true;

    const userAgentInfo = parseUserAgent(navigator.userAgent);

    // Send session start event
    trackEvent('session_start', {
      deviceType: userAgentInfo.deviceType,
      os: userAgentInfo.os,
      browser: userAgentInfo.browser,
      browserVersion: userAgentInfo.browserVersion,
      userAgent: navigator.userAgent,
      pageUrl: window.location.href,
      referrer: document.referrer,
      clientFingerprint: getClientFingerprint()
    });

    // Setup session timeout
    resetSessionTimeout();

    // Setup page visibility listener
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        clearTimeout(sessionEndTimer);
      } else {
        resetSessionTimeout();
      }
    });

    // Batch send events periodically
    startBatchInterval();
  }

  /**
   * Reset session timeout
   */
  function resetSessionTimeout() {
    if (sessionEndTimer) clearTimeout(sessionEndTimer);
    sessionEndTimer = setTimeout(function() {
      if (isSessionActive) {
        endSession();
      }
    }, SESSION_TIMEOUT);
  }

  /**
   * End session
   */
  function endSession() {
    if (!sessionId || !isSessionActive) return;

    isSessionActive = false;
    clearTimeout(sessionEndTimer);

    // Send remaining events
    if (eventQueue.length > 0) {
      sendBatch();
    }

    // Send session end event
    const sessionDuration = Math.round((Date.now() - new Date(sessionStartTime).getTime()) / 1000);
    trackEvent('session_end', {
      duration: sessionDuration
    }, true); // Force immediate send
  }

  /**
   * Start batch interval for sending queued events
   */
  function startBatchInterval() {
    if (batchTimer) return;

    batchTimer = setInterval(function() {
      if (eventQueue.length > 0) {
        sendBatch();
      }
    }, BATCH_INTERVAL);
  }

  /**
   * Track an event
   */
  function trackEvent(eventType, eventData, immediate = false) {
    if (!sessionId) {
      initSession();
    }

    const event = {
      sessionId: sessionId,
      eventType: eventType,
      eventData: eventData,
      timestamp: new Date().toISOString()
    };

    eventQueue.push(event);

    // Reset session timeout on user activity
    if (eventType !== 'session_start' && eventType !== 'session_end') {
      resetSessionTimeout();
    }

    if (immediate || eventQueue.length >= MAX_BATCH_SIZE) {
      sendBatch();
    }
  }

  /**
   * Send batched events to server
   */
  function sendBatch() {
    if (eventQueue.length === 0) return;

    const batch = eventQueue.splice(0, MAX_BATCH_SIZE);

    fetch(API_BASE + '/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        events: batch
      })
    }).catch(function(error) {
      console.log('[v0-analytics] Track error:', error);
      // Re-queue events on failure
      eventQueue = batch.concat(eventQueue);
    });
  }

  /**
   * Track calculation event
   */
  function trackCalculation(calculationType, inputValues, resultValues) {
    trackEvent('calculation', {
      type: calculationType,
      inputs: inputValues,
      results: resultValues
    });
  }

  /**
   * Track page view
   */
  function trackPageView(pagePath, timeOnPage) {
    trackEvent('page_view', {
      path: pagePath,
      timeOnPage: timeOnPage
    });
  }

  /**
   * Track engagement
   */
  function trackEngagement(action, details) {
    trackEvent('engagement', {
      action: action,
      details: details
    });
  }

  /**
   * Initialize on page load
   */
  function init() {
    // Initialize session
    initSession();

    // Track page unload
    window.addEventListener('beforeunload', function() {
      endSession();
    });

    // Expose tracking functions globally
    window.DEBATRE = window.DEBATRE || {};
    window.DEBATRE.analytics = {
      trackCalculation: trackCalculation,
      trackPageView: trackPageView,
      trackEngagement: trackEngagement,
      getSessionId: function() { return sessionId; }
    };

    console.log('[v0-analytics] Tracker initialized. Session ID:', sessionId);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
