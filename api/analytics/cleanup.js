/**
 * Analytics Cleanup API
 * Removes old analytics data to maintain database size
 * Should be called periodically via a cron job or Vercel functions scheduler
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Delete old analytics data
 * Keeps data for the past 30 days by default
 */
async function cleanupOldData(daysToKeep = 30) {
  const results = {};

  try {
    // Delete old page views
    const pageViewsResult = await pool.query(
      `DELETE FROM analytics_page_views 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysToKeep]
    );
    results.pageViewsDeleted = pageViewsResult.rowCount;

    // Delete old events
    const eventsResult = await pool.query(
      `DELETE FROM analytics_events 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysToKeep]
    );
    results.eventsDeleted = eventsResult.rowCount;

    // Delete old sessions
    const sessionsResult = await pool.query(
      `DELETE FROM analytics_sessions 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysToKeep]
    );
    results.sessionsDeleted = sessionsResult.rowCount;

    return {
      success: true,
      message: `Cleanup completed. Kept data for the past ${daysToKeep} days.`,
      results: results
    };
  } catch (error) {
    console.error('[analytics] Cleanup error:', error);
    throw error;
  }
}

/**
 * Get database size information
 */
async function getDatabaseSize() {
  try {
    const query = `
      SELECT
        schemaname,
        tablename,
        ROUND(pg_total_relation_size(schemaname||'.'||tablename) / 1024.0 / 1024.0, 2) as size_mb,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE tablename LIKE 'analytics%'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;

    const result = await pool.query(query);
    
    const totalSize = result.rows.reduce((sum, row) => sum + row.size_mb, 0);
    
    return {
      tables: result.rows,
      totalSizeMB: Math.round(totalSize * 100) / 100
    };
  } catch (error) {
    console.error('[analytics] Database size query error:', error);
    throw error;
  }
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
  // Verify this is called from Vercel's cron system or authorized source
  const authToken = req.headers['x-vercel-cron-secret'];
  const expectedToken = process.env.CLEANUP_CRON_SECRET || 'test-secret';

  // For development/testing, allow requests without auth header
  if (process.env.NODE_ENV === 'production' && authToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { action = 'cleanup', days = 30 } = req.query;

    if (action === 'cleanup') {
      const cleanupResult = await cleanupOldData(parseInt(days));
      return res.status(200).json(cleanupResult);
    }

    if (action === 'database-size') {
      const sizeInfo = await getDatabaseSize();
      return res.status(200).json({
        success: true,
        data: sizeInfo
      });
    }

    res.status(400).json({ error: 'Invalid action parameter' });
  } catch (error) {
    console.error('[analytics] Cleanup handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
