/**
 * Analytics Seed Data API
 * Generates sample analytics data for testing and demonstration
 * THIS SHOULD ONLY BE CALLED MANUALLY - NOT IN PRODUCTION
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Generate mock analytics data
 */
async function generateMockData() {
  try {
    const devices = ['desktop', 'mobile', 'tablet'];
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    const osOptions = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'];
    const cities = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang'];
    const countries = ['ID', 'SG', 'MY', 'TH', 'PH'];

    // Generate 20 sample sessions over the last 24 hours
    for (let i = 0; i < 20; i++) {
      const hoursAgo = Math.random() * 24;
      const sessionStart = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      const sessionEnd = new Date(sessionStart.getTime() + Math.random() * 30 * 60 * 1000);
      
      const device = devices[Math.floor(Math.random() * devices.length)];
      const browser = browsers[Math.floor(Math.random() * browsers.length)];
      const os = osOptions[Math.floor(Math.random() * osOptions.length)];
      const city = cities[Math.floor(Math.random() * cities.length)];
      const country = countries[Math.floor(Math.random() * countries.length)];
      const ipHash = Math.random().toString(36).substr(2, 64);

      const sessionId = `mock_sess_${i}_${Date.now()}`;

      // Insert session
      const sessionQuery = `
        INSERT INTO analytics_sessions (
          session_id, device_type, os, browser, browser_version,
          user_agent, ip_hash, city, country, latitude, longitude,
          session_start, session_end, duration_seconds, pages_visited, events_count,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      `;

      await pool.query(sessionQuery, [
        sessionId,
        device,
        os,
        browser,
        Math.floor(Math.random() * 10) + 1,
        `Mozilla/5.0 (${device}) Chrome/91.0`,
        ipHash,
        city,
        country,
        -6.2 + Math.random() * 0.5,
        106.8 + Math.random() * 0.5,
        sessionStart,
        sessionEnd,
        Math.floor((sessionEnd - sessionStart) / 1000),
        Math.floor(Math.random() * 5) + 1,
        Math.floor(Math.random() * 3) + 1
      ]);

      // Insert sample events
      const numEvents = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numEvents; j++) {
        const eventQuery = `
          INSERT INTO analytics_events (
            session_id, event_type, event_name, calculation_type,
            input_values, result_values, timestamp, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `;

        const inputs = {
          watt: Math.floor(Math.random() * 5000) + 100,
          hours: Math.floor(Math.random() * 12) + 1,
          voltage: [12, 24, 48][Math.floor(Math.random() * 3)],
          inverterEfficiency: [0.80, 0.85, 0.90][Math.floor(Math.random() * 3)],
          psh: [3, 4, 5][Math.floor(Math.random() * 3)]
        };

        const results = {
          batteryAh: Math.floor(Math.random() * 500) + 50,
          solarPanelWp: Math.floor(Math.random() * 5000) + 500,
          loadAmpere: Math.floor(Math.random() * 100) + 5,
          chargeAmpere: Math.floor(Math.random() * 150) + 10
        };

        await pool.query(eventQuery, [
          sessionId,
          'calculation',
          'PLTS_Calculation',
          'PLTS',
          JSON.stringify(inputs),
          JSON.stringify(results)
        ]);
      }
    }

    return { success: true, message: 'Mock data generated successfully', sessionsCreated: 20 };
  } catch (error) {
    console.error('[analytics-seed] Error:', error);
    throw error;
  }
}

/**
 * Main handler
 */
module.exports = async (req, res) => {
  // Only accept GET requests with a secret parameter
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple security check - require a secret parameter
  const secret = req.query.secret;
  if (secret !== 'Kukurtiko2021') {
    return res.status(401).json({ error: 'Unauthorized - invalid secret' });
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const result = await generateMockData();
    res.status(200).json(result);
  } catch (error) {
    console.error('[analytics-seed] Seed error:', error);
    res.status(500).json({ error: 'Failed to generate mock data', details: error.message });
  }
};
