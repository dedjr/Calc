# DEBATRE Analytics Dashboard - Setup & Documentation

Comprehensive analytics system untuk tracking pengunjung debatre.com dengan 12/24 jam terakhir dan informasi user lengkap.

## Overview

Sistem analytics yang kami bangun mengumpulkan data pengunjung secara real-time dan menyimpannya di Neon PostgreSQL. Dashboard interaktif menampilkan:

- **Visitor Metrics**: Total sessions, average duration, total calculations
- **Device Distribution**: Mobile, Tablet, Desktop breakdown
- **Browser & OS Analytics**: Chrome, Firefox, Safari, Windows, macOS, Linux, Android, iOS
- **Hourly Trends**: Session dan calculation trends per jam
- **Top Calculations**: Jenis kalkulasi yang paling sering dilakukan
- **Recent Sessions**: Daftar 20 sesi terakhir dengan detail lengkap
- **Session Details**: Per-session breakdown dengan device info, location, dan event history

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Calculator (index.html)                                     │
│ ├─ tracker.js (client-side) ────────┐                       │
└─────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/analytics/track                                   │
│ ├─ Parse device info, browser, OS                           │
│ ├─ Hash IP for privacy                                      │
│ └─ Store in analytics_sessions & analytics_events           │
└─────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Neon PostgreSQL Database                                    │
│ ├─ analytics_sessions (device, OS, browser, geo)            │
│ ├─ analytics_events (calculations, engagement)              │
│ └─ analytics_page_views (page paths, duration)              │
└─────────────────────────────────────────────────────────────┘
                                       ▲
                                       │
                    GET /api/analytics/data
                                       │
┌─────────────────────────────────────────────────────────────┐
│ Analytics Dashboard (analytics.html)                        │
│ ├─ Real-time charts (Chart.js)                              │
│ ├─ Device/Browser/OS distribution                           │
│ ├─ Hourly trends with interactive filters                   │
│ └─ Session detail modal view                                │
└─────────────────────────────────────────────────────────────┘
```

## Files Overview

### Client-Side (Tracking)

#### `tracker.js` (287 lines)
Client-side tracking library dengan fitur:
- **Session Management**: Auto-generate session ID, track 30-minute sessions
- **Device Detection**: Parse User-Agent untuk device type, OS, browser
- **Event Batching**: Queue events dan send dalam batch tiap 10 detik atau saat max 50 events
- **Privacy**: Hanya kirim client fingerprint (user agent + screen + timezone), IP hashing di server
- **Global API**: Expose `window.DEBATRE.analytics` untuk tracking calculations

**Key Functions**:
```javascript
// Inject tracking
<script src="tracker.js" defer></script>

// Track calculations
window.DEBATRE.analytics.trackCalculation('PLTS', inputValues, resultValues);

// Get current session ID
sessionId = window.DEBATRE.analytics.getSessionId();
```

### Backend APIs

#### `api/analytics/track.js` (208 lines)
POST endpoint untuk menerima tracking events.

**Request Body**:
```json
{
  "events": [
    {
      "sessionId": "sess_1234567890_abc123",
      "eventType": "session_start",
      "eventData": {
        "deviceType": "mobile",
        "os": "iOS",
        "browser": "Safari",
        "userAgent": "Mozilla/5.0..."
      },
      "timestamp": "2024-06-20T10:30:00Z"
    },
    {
      "sessionId": "sess_1234567890_abc123",
      "eventType": "calculation",
      "eventData": {
        "type": "PLTS",
        "inputs": { "watt": 500, "hours": 6, "voltage": 24 },
        "results": { "ah": 125, "wp": 1875, "ampere": 8.7 }
      },
      "timestamp": "2024-06-20T10:30:15Z"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "eventsProcessed": 2
}
```

#### `api/analytics/data.js` (280 lines)
GET endpoint untuk retrieve analytics data dengan multiple query types.

**Query Parameters**:
- `type`: summary, devices, browsers, os, trends, calculations, sessions, session-details
- `hours`: 12, 24, 168 (default: 24)
- `sessionId`: (required untuk session-details)

**Example Queries**:
```
/api/analytics/data?type=summary&hours=24
/api/analytics/data?type=devices&hours=12
/api/analytics/data?type=trends&hours=24
/api/analytics/data?type=session-details&sessionId=sess_123...
```

#### `api/analytics/cleanup.js` (124 lines)
Maintenance endpoint untuk delete old data. Designed untuk Vercel Cron Jobs.

**Features**:
- Delete analytics data older than specified days (default: 30)
- Get database size information
- Authorization via `CLEANUP_CRON_SECRET` header

**Setup Cron Job** (in `vercel.json`):
```json
{
  "crons": [{
    "path": "/api/analytics/cleanup?action=cleanup&days=30",
    "schedule": "0 2 * * *"
  }]
}
```

### Frontend (Dashboard)

#### `analytics.html` (647 lines)
Full-featured analytics dashboard dengan:

**Features**:
- Time filter buttons (12h, 24h, 7d)
- Summary metrics cards
- 4 interactive charts (Chart.js):
  - Hourly trends (line chart)
  - Device distribution (doughnut)
  - Browser distribution (horizontal bar)
  - OS distribution (pie)
- Top calculations table
- Recent sessions list dengan click-to-detail
- Session detail modal dengan full event history

**Real-Time Updates**: Auto-refresh setiap 30 detik

**Navigation**: Link dari calculator footer untuk easy access

## Database Schema

### `analytics_sessions` Table
```sql
CREATE TABLE analytics_sessions (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  device_type TEXT,          -- mobile, tablet, desktop
  os TEXT,                   -- Windows, macOS, Linux, Android, iOS
  browser TEXT,              -- Chrome, Firefox, Safari, Edge
  browser_version TEXT,      -- e.g., "120.0.123"
  user_agent TEXT,           -- Full user agent string
  ip_hash TEXT,              -- SHA256 hash of IP for privacy
  city TEXT,                 -- Geo location (nullable)
  country TEXT,              -- Geo location (nullable)
  latitude FLOAT,            -- Geo location (nullable)
  longitude FLOAT,           -- Geo location (nullable)
  session_start TIMESTAMP,   -- When session started
  session_end TIMESTAMP,     -- When session ended (nullable)
  duration_seconds INT,      -- Total session duration
  pages_visited INT,         -- Count of page views
  events_count INT,          -- Count of events
  created_at TIMESTAMP,      -- Record creation time
  updated_at TIMESTAMP       -- Last update time
);

CREATE INDEX idx_analytics_sessions_created_at ON analytics_sessions(created_at DESC);
CREATE INDEX idx_analytics_sessions_session_id ON analytics_sessions(session_id);
```

### `analytics_events` Table
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,           -- session_start, calculation, engagement, etc
  event_name TEXT,                    -- Specific event name
  calculation_type TEXT,              -- Type of calculation (e.g., PLTS)
  input_values JSONB,                 -- JSON object of input parameters
  result_values JSONB,                -- JSON object of results
  timestamp TIMESTAMP,                -- When event occurred
  created_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
```

### `analytics_page_views` Table
```sql
CREATE TABLE analytics_page_views (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  page_path TEXT,                     -- Page URL path
  referrer TEXT,                      -- Referrer URL
  time_on_page INT,                   -- Seconds spent on page
  timestamp TIMESTAMP,                -- When viewed
  created_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_page_views_session_id ON analytics_page_views(session_id);
CREATE INDEX idx_analytics_page_views_timestamp ON analytics_page_views(timestamp DESC);
```

## Integration with Calculator

### Automatic Tracking

Calculator sudah ter-integrasi dengan tracking. Setiap kali user mengubah input dan calculation dilakukan:

```javascript
window.DEBATRE.analytics.trackCalculation('PLTS', {
  watt: 500,
  hours: 6,
  voltage: 24,
  inverterEfficiency: 0.85,
  psh: 5
}, {
  batteryAh: 150,
  solarPanelWp: 1875,
  loadAmpere: 8.7,
  chargeAmpere: 78.1
});
```

Data ini disimpan sebagai `analytics_events` dengan tipe `calculation`.

## Privacy & Security

### Privacy Measures
- **IP Hashing**: IP address di-hash dengan SHA256 sebelum disimpan
- **No Personal Data**: Tidak mengumpulkan nama, email, atau identitas user
- **Device Fingerprinting**: Hanya user agent, screen size, timezone (tidak unique)
- **Data Retention**: Automatic cleanup setelah 30 hari

### Security
- **CORS**: Analytics API bisa diakses dari domain manapun (read-only safe)
- **Cron Secret**: Cleanup endpoint protected dengan `CLEANUP_CRON_SECRET`
- **Prepared Statements**: Semua database queries gunakan parameterized statements
- **Input Validation**: Events di-validate sebelum disimpan

## Setup Instructions

### 1. Environment Variables

Pastikan environment variables di-set di Vercel:

```
DATABASE_URL=postgresql://user:password@host/db
CLEANUP_CRON_SECRET=your-secret-key-here
IP_HASH_SALT=your-salt-here
```

### 2. Deploy

Push ke repository dan Vercel akan auto-deploy:

```bash
git push origin main
```

Analytics otomatis aktif setelah deployment.

### 3. Access Analytics Dashboard

Buka: `https://debatre.com/analytics`

### 4. Setup Automatic Cleanup (Optional)

Add ke `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/analytics/cleanup?action=cleanup&days=30",
    "schedule": "0 2 * * *"
  }]
}
```

## API Reference

### Track Event
```
POST /api/analytics/track
```

### Get Analytics Data
```
GET /api/analytics/data?type=summary&hours=24
GET /api/analytics/data?type=devices&hours=24
GET /api/analytics/data?type=browsers&hours=24
GET /api/analytics/data?type=os&hours=24
GET /api/analytics/data?type=trends&hours=24
GET /api/analytics/data?type=calculations&hours=24
GET /api/analytics/data?type=sessions&hours=24
GET /api/analytics/data?type=session-details&sessionId=sess_...
```

### Database Maintenance
```
GET /api/analytics/cleanup?action=cleanup&days=30
GET /api/analytics/cleanup?action=database-size
```

## Monitoring & Troubleshooting

### Check Tracking Status
Open browser console (F12) and look for:
```
[v0-analytics] Tracker initialized. Session ID: sess_...
```

### Verify Events Are Being Sent
Network tab → Filter by `/api/analytics/track` → Should see POST requests

### Check Database Size
```bash
curl "https://debatre.com/api/analytics/cleanup?action=database-size"
```

### Manual Cleanup
```bash
curl "https://debatre.com/api/analytics/cleanup?action=cleanup&days=30" \
  -H "x-vercel-cron-secret: YOUR_SECRET"
```

## Future Enhancements

- [ ] Export data to CSV
- [ ] Geo-mapping untuk visitor locations
- [ ] User segmentation & cohort analysis
- [ ] Funnel analysis untuk multi-step calculations
- [ ] A/B testing support
- [ ] Real-time alerts untuk anomalies
- [ ] Integration dengan Google Analytics for cross-validation

## Support

Untuk pertanyaan atau issues:
1. Check console logs untuk error messages
2. Verify DATABASE_URL connection
3. Ensure Neon analytics tables exist
4. Check Vercel deployment logs

---

**Dashboard URL**: `/analytics`  
**Documentation Version**: 1.0  
**Last Updated**: 2024-06-20
