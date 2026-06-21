/**
 * Analytics Data API
 * Retrieves aggregated analytics data for the dashboard
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Get analytics summary for time period
 */
async function getAnalyticsSummary(hours = 24) {
  const query = `
    SELECT
      COUNT(DISTINCT session_id) as total_sessions,
      COUNT(DISTINCT CASE WHEN device_type = 'mobile' THEN session_id END) as mobile_sessions,
      COUNT(DISTINCT CASE WHEN device_type = 'tablet' THEN session_id END) as tablet_sessions,
      COUNT(DISTINCT CASE WHEN device_type = 'desktop' THEN session_id END) as desktop_sessions,
      ROUND(AVG(EXTRACT(EPOCH FROM (session_end - session_start))))::INT as avg_session_duration,
      COUNT(DISTINCT ae.id) as total_events,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'calculation' THEN ae.id END) as total_calculations
    FROM analytics_sessions s
    LEFT JOIN analytics_events ae ON s.session_id = ae.session_id
    WHERE s.created_at > NOW() - INTERVAL '1 hour' * $1
  `;

  const result = await pool.query(query, [hours]);
  return result.rows[0] || {};
}

/**
 * Get device distribution
 */
async function getDeviceDistribution(hours = 24) {
  const query = `
    SELECT
      device_type,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::INT as percentage
    FROM analytics_sessions
    WHERE created_at > NOW() - INTERVAL '1 hour' * $1
    GROUP BY device_type
    ORDER BY count DESC
  `;

  const result = await pool.query(query, [hours]);
  return result.rows;
}

/**
 * Get browser distribution
 */
async function getBrowserDistribution(hours = 24) {
  const query = `
    SELECT
      browser,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::INT as percentage
    FROM analytics_sessions
    WHERE created_at > NOW() - INTERVAL '1 hour' * $1 AND browser IS NOT NULL
    GROUP BY browser
    ORDER BY count DESC
  `;

  const result = await pool.query(query, [hours]);
  return result.rows;
}

/**
 * Get OS distribution
 */
async function getOSDistribution(hours = 24) {
  const query = `
    SELECT
      os,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::INT as percentage
    FROM analytics_sessions
    WHERE created_at > NOW() - INTERVAL '1 hour' * $1 AND os IS NOT NULL
    GROUP BY os
    ORDER BY count DESC
  `;

  const result = await pool.query(query, [hours]);
  return result.rows;
}

/**
 * Get hourly session trends
 */
async function getHourlyTrends(hours = 24) {
  const query = `
    SELECT
      DATE_TRUNC('hour', created_at) as hour,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(DISTINCT CASE WHEN event_type = 'calculation' THEN id END) as calculations
    FROM analytics_sessions s
    LEFT JOIN analytics_events e ON s.session_id = e.session_id
    WHERE s.created_at > NOW() - INTERVAL '1 hour' * $1
    GROUP BY DATE_TRUNC('hour', created_at)
    ORDER BY hour DESC
  `;

  const result = await pool.query(query, [hours]);
  return result.rows;
}

/**
 * Get top calculation types
 */
async function getTopCalculations(hours = 24, limit = 10) {
  const query = `
    SELECT
      calculation_type,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::INT as percentage
    FROM analytics_events
    WHERE created_at > NOW() - INTERVAL '1 hour' * $1
      AND event_type = 'calculation'
      AND calculation_type IS NOT NULL
    GROUP BY calculation_type
    ORDER BY count DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [hours, limit]);
  return result.rows;
}

/**
 * Get recent sessions
 */
async function getRecentSessions(hours = 24, limit = 20) {
  const query = `
    SELECT
      session_id,
      device_type,
      os,
      browser,
      session_start,
      session_end,
      EXTRACT(EPOCH FROM (COALESCE(session_end, NOW()) - session_start))::INT as duration_seconds,
      events_count
    FROM analytics_sessions
    WHERE created_at > NOW() - INTERVAL '1 hour' * $1
    ORDER BY session_start DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [hours, limit]);
  return result.rows;
}

/**
 * Get session details with events
 */
async function getSessionDetails(sessionId) {
  const sessionQuery = `
    SELECT
      session_id,
      device_type,
      os,
      browser,
      browser_version,
      city,
      country,
      session_start,
      session_end,
      EXTRACT(EPOCH FROM (COALESCE(session_end, NOW()) - session_start))::INT as duration_seconds,
      events_count
    FROM analytics_sessions
    WHERE session_id = $1
  `;

  const eventsQuery = `
    SELECT
      event_type,
      event_name,
      calculation_type,
      input_values,
      result_values,
      timestamp
    FROM analytics_events
    WHERE session_id = $1
    ORDER BY timestamp ASC
  `;

  const pageViewsQuery = `
    SELECT
      page_path,
      time_on_page,
      timestamp
    FROM analytics_page_views
    WHERE session_id = $1
    ORDER BY timestamp ASC
  `;

  try {
    const [sessionRes, eventsRes, pageViewsRes] = await Promise.all([
      pool.query(sessionQuery, [sessionId]),
      pool.query(eventsQuery, [sessionId]),
      pool.query(pageViewsQuery, [sessionId])
    ]);

    return {
      session: sessionRes.rows[0] || null,
      events: eventsRes.rows,
      pageViews: pageViewsRes.rows
    };
  } catch (error) {
    console.error('[analytics] Session details error:', error);
    throw error;
  }
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const { type = 'summary', hours = '24', sessionId } = req.query;
    const hoursInt = parseInt(hours) || 24;

    let data;

    switch (type) {
      case 'summary':
        data = await getAnalyticsSummary(hoursInt);
        break;
      case 'devices':
        data = await getDeviceDistribution(hoursInt);
        break;
      case 'browsers':
        data = await getBrowserDistribution(hoursInt);
        break;
      case 'os':
        data = await getOSDistribution(hoursInt);
        break;
      case 'trends':
        data = await getHourlyTrends(hoursInt);
        break;
      case 'calculations':
        data = await getTopCalculations(hoursInt);
        break;
      case 'sessions':
        data = await getRecentSessions(hoursInt);
        break;
      case 'session-details':
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId parameter required' });
        }
        data = await getSessionDetails(sessionId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type parameter' });
    }

    res.status(200).json({
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[analytics] Data retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
