/**
 * Analytics Track API
 * Receives tracking events from clients and stores them in the database
 */

const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Hash IP address for privacy
 */
function hashIP(ip) {
  if (!ip) return null;
  return crypto
    .createHash('sha256')
    .update(ip + process.env.IP_HASH_SALT || 'debatre-salt')
    .digest('hex')
    .substring(0, 16);
}

/**
 * Get client IP from request
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Fetch geolocation data from IP (optional - requires external service)
 * For now, we'll leave city/country as null (can be enhanced with MaxMind or similar)
 */
async function getGeoLocation(ip) {
  return {
    city: null,
    country: null,
    latitude: null,
    longitude: null
  };
}

/**
 * Get or create session in database
 */
async function getOrCreateSession(sessionId, userAgentInfo, ipHash, geoData) {
  const query = `
    INSERT INTO analytics_sessions (
      session_id, device_type, os, browser, browser_version,
      user_agent, ip_hash, city, country, latitude, longitude,
      session_start, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
    ON CONFLICT (session_id) DO UPDATE SET
      updated_at = NOW(),
      events_count = analytics_sessions.events_count + 1
    RETURNING id;
  `;

  try {
    const result = await pool.query(query, [
      sessionId,
      userAgentInfo.deviceType || null,
      userAgentInfo.os || null,
      userAgentInfo.browser || null,
      userAgentInfo.browserVersion || null,
      userAgentInfo.userAgent || null,
      ipHash,
      geoData?.city || null,
      geoData?.country || null,
      geoData?.latitude || null,
      geoData?.longitude || null
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('[analytics] Session creation error:', error);
    throw error;
  }
}

/**
 * Store event in database
 */
async function storeEvent(sessionId, event, geoData) {
  const { eventType, eventData, timestamp } = event;

  let query = '';
  let values = [];

  if (eventType === 'calculation') {
    query = `
      INSERT INTO analytics_events (
        session_id, event_type, event_name, calculation_type,
        input_values, result_values, timestamp, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    values = [
      sessionId,
      eventType,
      'calculation_performed',
      eventData?.type || null,
      JSON.stringify(eventData?.inputs || {}),
      JSON.stringify(eventData?.results || {}),
      timestamp
    ];
  } else if (eventType === 'page_view') {
    query = `
      INSERT INTO analytics_page_views (
        session_id, page_path, time_on_page, timestamp, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `;
    values = [
      sessionId,
      eventData?.path || '/',
      eventData?.timeOnPage || 0,
      timestamp
    ];
  } else {
    query = `
      INSERT INTO analytics_events (
        session_id, event_type, event_name,
        input_values, timestamp, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `;
    values = [
      sessionId,
      eventType,
      eventData?.action || eventType,
      JSON.stringify(eventData || {}),
      timestamp
    ];
  }

  try {
    await pool.query(query, values);
  } catch (error) {
    console.error('[analytics] Event storage error:', error);
    throw error;
  }
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Invalid events data' });
    }

    const clientIP = getClientIP(req);
    const ipHash = hashIP(clientIP);
    const geoData = await getGeoLocation(clientIP);

    // Process first event to get session info and create/update session
    const firstEvent = events[0];
    const sessionId = firstEvent.sessionId;
    const userAgentInfo = firstEvent.eventData || {};

    // Create or update session
    if (firstEvent.eventType === 'session_start') {
      await getOrCreateSession(sessionId, userAgentInfo, ipHash, geoData);
    }

    // Store all events
    for (const event of events) {
      await storeEvent(sessionId, event, geoData);
    }

    // Update session last activity
    await pool.query(
      `UPDATE analytics_sessions SET updated_at = NOW() WHERE session_id = $1`,
      [sessionId]
    );

    res.status(200).json({
      success: true,
      eventsProcessed: events.length
    });
  } catch (error) {
    console.error('[analytics] Tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
