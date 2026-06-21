# Analytics Dashboard - Quick Start Guide

## 🚀 What's New

Your calculator now has a **complete real-time analytics system** tracking visitor data for 12/24 hour periods with:

- **Device Distribution**: Mobile, Tablet, Desktop breakdown
- **Browser & OS Analytics**: Chrome, Firefox, Safari on Windows, macOS, Linux, Android, iOS
- **Hourly Trends**: Live charts showing sessions and calculations per hour
- **Calculation History**: Track which types of calculations users perform
- **Session Details**: Click any session to see full event history
- **Privacy**: IP hashing, 30-day auto-cleanup, no personal data collected

## 📊 Access Analytics Dashboard

Open: **`/analytics`** on your domain

Example: `https://debatre.com/analytics`

Or click the **📊 Analytics** link in the calculator footer.

## 📁 Files Added

```
tracker.js                      ← Client-side tracking (auto-injected)
analytics.html                  ← Dashboard page
api/analytics/
  ├─ track.js                  ← Event ingestion API
  ├─ data.js                   ← Query API for dashboard
  └─ cleanup.js                ← Database maintenance
ANALYTICS_SETUP.md              ← Full documentation
```

## 🔧 How It Works

### Step 1: Visitor Arrives
- `tracker.js` detects device type, browser, OS
- Creates unique session ID
- Starts tracking in browser

### Step 2: User Performs Calculations
- Each calculation is tracked with inputs & results
- Events are batched and sent to `/api/analytics/track`
- Server stores in Neon database

### Step 3: View in Dashboard
- Open `/analytics`
- Select time window (12h, 24h, 7d)
- View real-time charts and session details

## 📊 Dashboard Features

### Time Filters
- **12 Jam Terakhir** - Last 12 hours (default)
- **24 Jam Terakhir** - Last 24 hours
- **7 Hari Terakhir** - Last 7 days

### Metrics Cards
- **Total Sessions** - Number of unique visitors
- **Avg Session Duration** - Average time spent
- **Total Calculations** - Total calculations performed
- **Total Events** - All tracked events

### Charts
1. **Hourly Trends** - Sessions and calculations per hour
2. **Device Distribution** - Mobile vs Tablet vs Desktop (doughnut)
3. **Browser Distribution** - Chrome, Firefox, Safari, etc (bar chart)
4. **Operating System** - Windows, macOS, Linux, Android, iOS (pie)

### Tables
1. **Top Calculations** - Most popular calculation types
2. **Recent Sessions** - Last 20 sessions with quick details

### Session Details
Click any session to see:
- Full device info (device type, OS, browser)
- Location (if available)
- Session duration
- All events performed during session

## 🔒 Privacy Features

✓ IP addresses are hashed (SHA256) before storage  
✓ Only 30 days of data retained (auto-cleanup)  
✓ No personal data collected (no names, emails, IDs)  
✓ Device fingerprinting only (user agent, screen size, timezone)  
✓ All data deleted after 30 days automatically  

## 🗄️ Database

Analytics uses Neon PostgreSQL with 3 tables:
- `analytics_sessions` - Visitor sessions
- `analytics_events` - Calculation and interaction events
- `analytics_page_views` - Page view tracking

All tables indexed for fast queries.

## 🧹 Data Cleanup

Automatic cleanup runs daily at 2 AM UTC:
- Removes data older than 30 days
- Keeps database size manageable
- You can trigger manually via API

## 🛠️ Development

### Test Locally
```bash
# Start dev server
npm run dev  # or your dev command

# Open calculator
http://localhost:3000

# Check console for tracking confirmation
[v0-analytics] Tracker initialized. Session ID: sess_...

# Open analytics
http://localhost:3000/analytics
```

### Check Tracking Status
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for `[v0-analytics]` messages
4. Go to Network tab
5. Perform a calculation
6. Should see POST to `/api/analytics/track`

### Monitor API
```bash
# Check recent database size
curl "https://debatre.com/api/analytics/cleanup?action=database-size"

# Manually trigger cleanup (needs CLEANUP_CRON_SECRET)
curl "https://debatre.com/api/analytics/cleanup?action=cleanup&days=30" \
  -H "x-vercel-cron-secret: YOUR_SECRET"
```

## 📈 Tracked Data

When user performs a calculation, we track:

**Inputs**:
- Daya Output (Watt)
- Jam Penggunaan
- Tegangan Sistem
- Efisiensi Inverter
- Kondisi Cuaca/PSH

**Results**:
- Kapasitas Baterai (Ah)
- Panel Surya (Wp)
- Arus Beban (A)
- Arus Pengisian (A)

Plus device/browser/OS info and timestamp.

## 🚨 Troubleshooting

### Analytics page shows "No data"
1. Check if `DATABASE_URL` is set in Vercel
2. Verify analytics tables exist in Neon
3. Try refreshing page
4. Check browser console for errors

### Tracker not sending events
1. Open DevTools Console (F12)
2. Look for `[v0-analytics]` messages
3. Check Network tab for `/api/analytics/track` calls
4. Verify API endpoint responds with `{success: true}`

### Database size growing too large
1. Check current size: `/api/analytics/cleanup?action=database-size`
2. Trigger cleanup: `/api/analytics/cleanup?action=cleanup&days=30`
3. Set lower retention: `&days=7` for weekly cleanup

### Slow dashboard loading
1. Try shorter time window (12h instead of 168h)
2. Check database query performance
3. Verify Neon connection string is correct
4. Check Vercel function logs

## 📞 Next Steps

1. **Deploy**: Push changes to production
2. **Monitor**: Open `/analytics` and watch data come in
3. **Customize**: Modify `analytics.html` for custom charts
4. **Integrate**: Connect with external analytics tools (optional)

## 💡 Tips

- Dashboard auto-refreshes every 30 seconds
- Click session row to expand details
- Use time filters to focus on specific periods
- Mobile browsers fully supported
- Works 100% client-side charts (no external CDN issues)

## 📚 Full Documentation

See `ANALYTICS_SETUP.md` for:
- Complete API reference
- Database schema details
- Advanced setup options
- Future enhancement ideas

---

**Happy Analytics Tracking! 📊**  
Questions? Check the full documentation or browser console logs.
