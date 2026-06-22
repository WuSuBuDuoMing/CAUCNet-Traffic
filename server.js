/**
 * CAUCNet Traffic -- Campus Network Traffic Monitoring Server
 *
 * Provides a REST API and Server-Sent Events (SSE) push for real-time
 * network speed monitoring, traffic statistics, online device management,
 * connection quality checks, threshold alerts, and more.
 *
 * @module server
 * @version 1.13.0
 * @author WuSuBuDuoMing
 * @license MIT
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const net = require('net');
const https = require('https');
const { execSync } = require('child_process');
const { TrafficSimulator } = require('./services/simulator');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

// ============================
// Response Cache (in-memory, TTL-based)
// ============================
const responseCache = new Map();
const CACHE_TTL = 3000; // 3 seconds default

/**
 * Cache middleware for GET endpoints.
 * @param {string} key - Cache key
 * @param {number} [ttl=CACHE_TTL] - Time-to-live in ms
 */
function cacheMiddleware(key, ttl = CACHE_TTL) {
  return (req, res, next) => {
    const cached = responseCache.get(key);
    if (cached && (Date.now() - cached.time) < ttl) {
      return res.json(cached.data);
    }
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      responseCache.set(key, { data, time: Date.now() });
      return originalJson(data);
    };
    next();
  };
}

// ============================
// Rate Limiter (per-IP, sliding window)
// ============================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 120;      // max requests per window

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitMap.set(ip, entry);
  }
  // Purge expired timestamps
  entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (entry.timestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }
  entry.timestamps.push(now);
  next();
}

// Periodic cleanup of stale rate limit entries (every 5 minutes)
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW;
  for (const [ip, entry] of rateLimitMap) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) rateLimitMap.delete(ip);
  }
}, 300000);

// Security headers + request logging
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.use(rateLimiter);

// Static file caching
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

// ============================
// Traffic Simulation Engine
// ============================
const sim = new TrafficSimulator();

// ============================
// SSE Clients
// ============================
/** @type {Set<import('express').Response>} */
const sseClients = new Set();

/**
 * Broadcast an SSE event to all connected clients.
 * Removes clients that fail to write.
 * @param {string} eventType - The SSE event name
 * @param {object} data - JSON-serializable data payload
 */
app.locals.broadcastSSE = (eventType, data) => {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) { try { c.write(payload); } catch { sseClients.delete(c); } }
};

/**
 * SSE endpoint -- clients connect here to receive real-time updates.
 * Sends a `connected` event on connect, heartbeats every 15s, and
 * periodic speed/overview/stats/trend updates via the broadcast loop.
 * @route GET /api/stream
 */
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected' })}\n\n`);
  sseClients.add(res);
  const hb = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => { sseClients.delete(res); clearInterval(hb); });
});

// ============================
// REST API
// ============================

/**
 * Get current upload and download speed in Mbps.
 * @route GET /api/speed
 * @returns {{ success: true, data: { download: number, upload: number, downloadPeak: number, uploadPeak: number } }}
 */
app.get('/api/speed', cacheMiddleware('speed'), (req, res) => {
  res.json({ success: true, data: sim.getSpeed() });
});

/**
 * Get traffic overview including account info, usage, and session duration.
 * @route GET /api/overview
 * @returns {{ success: true, data: object }}
 */
app.get('/api/overview', cacheMiddleware('overview'), (req, res) => {
  res.json({ success: true, data: sim.getOverview() });
});

/**
 * Get list of active online devices with masked MAC/IP.
 * @route GET /api/devices
 * @returns {{ success: true, data: Array<object> }}
 */
app.get('/api/devices', (req, res) => {
  res.json({ success: true, data: sim.getDevices() });
});

/**
 * Logout (deactivate) a device by ID.
 * Broadcasts a `device_update` SSE event on success.
 * @route POST /api/devices/:id/logout
 * @param {string} req.params.id - Device ID
 * @returns {{ success: boolean, message: string }}
 */
app.post('/api/devices/:id/logout', (req, res) => {
  const ok = sim.logoutDevice(req.params.id);
  if (ok) {
    responseCache.delete('devices');
    app.locals.broadcastSSE('device_update', { devices: sim.getDevices() });
  }
  res.json({ success: ok, message: ok ? 'Device logged out' : 'Device not found' });
});

/**
 * Get today and month traffic statistics.
 * @route GET /api/stats
 * @returns {{ success: true, data: { today: object, month: object } }}
 */
app.get('/api/stats', cacheMiddleware('stats'), (req, res) => {
  res.json({ success: true, data: sim.getStats() });
});

/**
 * Get traffic trend data for the last 24 hours.
 * @route GET /api/trend
 * @returns {{ success: true, data: Array<object> }}
 */
app.get('/api/trend', (req, res) => {
  res.json({ success: true, data: sim.getTrend() });
});

/**
 * Get current threshold alert settings.
 * @route GET /api/thresholds
 * @returns {{ success: true, data: object }}
 */
app.get('/api/thresholds', (req, res) => {
  res.json({ success: true, data: sim.getThresholds() });
});

/**
 * Update threshold alert settings.
 * @route POST /api/thresholds
 * @param {object} req.body - Partial threshold settings to merge
 * @returns {{ success: true }}
 */
app.post('/api/thresholds', (req, res) => {
  const t = req.body;
  if (t && typeof t === 'object') {
    if (typeof t.trafficWarn === 'number') sim.thresholds.trafficWarn = t.trafficWarn;
    if (typeof t.balanceWarn === 'number') sim.thresholds.balanceWarn = t.balanceWarn;
  }
  responseCache.delete('thresholds');
  res.json({ success: true });
});

/**
 * Get campus network login status.
 * @route GET /api/login-status
 * @returns {{ success: true, data: object }}
 */
app.get('/api/login-status', (req, res) => {
  res.json({ success: true, data: sim.getLoginStatus() });
});

// ============================
// v1.11.0 -- Data Export Endpoints
// ============================

/**
 * Export traffic history as CSV.
 * @route GET /api/export/csv
 * @param {string} [req.query.hours=24] - Number of hours to export
 * @returns {csv} CSV file download
 */
app.get('/api/export/csv', (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const cutoff = Date.now() - hours * 3600 * 1000;
  const data = trafficLog.filter(d => new Date(d.time).getTime() > cutoff);
  const header = 'Time,Download (Mbps),Upload (Mbps),Latency (ms)\n';
  const rows = data.map(d => `${d.time},${d.download.toFixed(2)},${d.upload.toFixed(2)},${d.latency}`).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=caucnet-traffic-export-${new Date().toISOString().split('T')[0]}.csv`);
  res.send(header + rows);
});

/**
 * Export traffic history as JSON (bulk download).
 * @route GET /api/export/json
 * @param {string} [req.query.hours=24] - Number of hours to export
 * @returns {object} JSON file download
 */
app.get('/api/export/json', (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const cutoff = Date.now() - hours * 3600 * 1000;
  const data = trafficLog.filter(d => new Date(d.time).getTime() > cutoff);
  const exportData = {
    exportTime: new Date().toISOString(),
    version: 'CAUCNet Traffic v1.13.0',
    hours,
    recordCount: data.length,
    speed: sim.getSpeed(),
    overview: sim.getOverview(),
    stats: sim.getStats(),
    devices: sim.getDevices(),
    trend: sim.getTrend(),
    history: data,
  };
  res.setHeader('Content-Disposition', `attachment; filename=caucnet-traffic-export-${new Date().toISOString().split('T')[0]}.json`);
  res.json(exportData);
});

/**
 * Export current stats as Excel-compatible TSV (tab-separated).
 * @route GET /api/export/tsv
 * @returns {tsv} TSV file download
 */
app.get('/api/export/tsv', (req, res) => {
  const stats = sim.getStats();
  const overview = sim.getOverview();
  const header = 'Metric\tValue\n';
  const rows = [
    `Export Time\t${new Date().toISOString()}`,
    `Today Download (GB)\t${stats.today.downloadGB}`,
    `Today Upload (GB)\t${stats.today.uploadGB}`,
    `Today Total (GB)\t${stats.today.totalGB}`,
    `Month Download (GB)\t${stats.month.downloadGB}`,
    `Month Upload (GB)\t${stats.month.uploadGB}`,
    `Month Total (GB)\t${stats.month.totalGB}`,
    `Month Avg Daily (GB)\t${stats.month.avgDailyGB}`,
    `Balance\t${overview.balance}`,
    `Session Used (MB)\t${overview.sessionUsedMB}`,
    `Session Duration (s)\t${overview.sessionDuration}`,
  ].join('\n');
  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=caucnet-traffic-stats-${new Date().toISOString().split('T')[0]}.tsv`);
  res.send(header + rows);
});

// ============================
// v1.12.0 -- Historical Trend Comparison
// ============================

/**
 * Compare today's traffic trend with a previous day.
 * @route GET /api/compare
 * @param {string} [req.query.days=1] - Number of days to compare (1-7)
 * @returns {{ success: true, data: { today: Array, comparison: Array, delta: object } }}
 */
app.get('/api/compare', (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 1, 1), 7);
  const todayTrend = sim.getTrend();
  // Generate simulated comparison data (mirrors the current day with slight variation)
  const comparisonTrend = todayTrend.map(p => ({
    time: p.time,
    hour: p.hour,
    download: Math.round(p.download * (0.7 + Math.random() * 0.6) * 10) / 10,
    upload: Math.round(p.upload * (0.7 + Math.random() * 0.6) * 10) / 10,
  }));
  const todayAvg = todayTrend.length > 0 ? todayTrend.reduce((s, p) => s + p.download, 0) / todayTrend.length : 0;
  const compAvg = comparisonTrend.length > 0 ? comparisonTrend.reduce((s, p) => s + p.download, 0) / comparisonTrend.length : 0;
  res.json({
    success: true,
    data: {
      today: todayTrend,
      comparison: comparisonTrend,
      delta: {
        todayAvgMbps: Math.round(todayAvg * 10) / 10,
        comparisonAvgMbps: Math.round(compAvg * 10) / 10,
        difference: Math.round((todayAvg - compAvg) * 10) / 10,
        percentChange: compAvg > 0 ? Math.round((todayAvg - compAvg) / compAvg * 100) : 0,
      },
    },
  });
});

// ============================
// v1.13.0 -- Enhanced Threshold Alerts & Alert History
// ============================

/** @type {Array<{ time: string, type: string, message: string, severity: string }>} */
const alertHistory = [];

/**
 * Get full alert history log.
 * @route GET /api/alerts
 * @param {string} [req.query.limit=50] - Max records to return
 * @returns {{ success: true, data: Array<object> }}
 */
app.get('/api/alerts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  res.json({ success: true, data: alertHistory.slice(-limit) });
});

/**
 * Clear alert history.
 * @route POST /api/alerts/clear
 * @returns {{ success: true, message: string }}
 */
app.get('/api/alerts/clear', (req, res) => {
  alertHistory.length = 0;
  res.json({ success: true, message: 'Alert history cleared' });
});

/**
 * Get server-side statistics (uptime, memory, cache stats, request count).
 * @route GET /api/server-stats
 * @returns {{ success: true, data: object }}
 */
app.get('/api/server-stats', (req, res) => {
  res.json({
    success: true,
    data: {
      uptime: process.uptime().toFixed(0),
      memoryUsage: {
        heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB',
        heapTotal: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1) + ' MB',
        rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + ' MB',
      },
      cacheSize: responseCache.size,
      sseClients: sseClients.size,
      alertHistoryCount: alertHistory.length,
      trafficLogCount: trafficLog.length,
      nodeVersion: process.version,
    },
  });
});

// ============================
// SSE Broadcast Loop
// ============================
setInterval(() => {
  sim.tick();
  const broadcast = app.locals.broadcastSSE;
  broadcast('speed_update', sim.getSpeed());
  broadcast('overview_update', sim.getOverview());
  broadcast('stats_update', sim.getStats());
  broadcast('trend_update', sim.getTrend());
}, 1000);

// ============================
// Connection Quality -- Latency Measurement
// ============================
/** @type {number} Current ping latency in milliseconds */
let pingLatency = 0;

setInterval(() => {
  const start = Date.now();
  const socket = new net.Socket();
  socket.setTimeout(2000);
  socket.connect(80, '10.80.80.250', () => {
    pingLatency = Date.now() - start;
    socket.destroy();
  });
  socket.on('error', () => { pingLatency = 999; socket.destroy(); });
  socket.on('timeout', () => { pingLatency = 999; socket.destroy(); });
}, 5000);

/**
 * Get connection quality metrics (latency and quality rating).
 * @route GET /api/quality
 * @returns {{ success: true, data: { latencyMs: number, quality: string } }}
 */
app.get('/api/quality', (req, res) => {
  res.json({
    success: true,
    data: {
      latencyMs: pingLatency,
      quality: pingLatency < 20 ? 'excellent' : pingLatency < 50 ? 'good' : pingLatency < 100 ? 'fair' : 'poor',
    },
  });
});

/**
 * Get active network adapter information via Windows PowerShell.
 * @route GET /api/network-info
 * @returns {{ success: true, data: Array<{ Name: string, InterfaceDescription: string, LinkSpeed: string, MacAddress: string }> }}
 */
app.get('/api/network-info', (req, res) => {
  try {
    const raw = execSync(
      'powershell -NoProfile -Command "Get-NetAdapter | Where-Object {$_.Status -eq \\"Up\\"} | Select-Object Name,InterfaceDescription,LinkSpeed,MacAddress | ConvertTo-Json"',
      { encoding: 'utf-8', timeout: 5000, windowsHide: true }
    );
    const adapters = JSON.parse(raw);
    res.json({ success: true, data: Array.isArray(adapters) ? adapters : [adapters] });
  } catch { res.json({ success: true, data: [] }); }
});

/**
 * Get IP geolocation info from ipinfo.io.
 * @route GET /api/ip-info
 * @returns {{ success: boolean, data?: object }}
 */
app.get('/api/ip-info', (req, res) => {
  https.get('https://ipinfo.io/json', (r) => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => {
      try { res.json({ success: true, data: JSON.parse(d) }); } catch { res.json({ success: false }); }
    });
  }).on('error', () => res.json({ success: false }));
});

/**
 * Get bandwidth usage analysis and monthly projection.
 * @route GET /api/bandwidth-analysis
 * @returns {{ success: true, data: { avgDaily: string, projected: string, daysLeft: number, utilization: string } }}
 */
app.get('/api/bandwidth-analysis', (req, res) => {
  const stats = sim.getStats();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  const avgDaily = dayOfMonth > 0 ? stats.month.totalGB / dayOfMonth : 0;
  res.json({
    success: true,
    data: {
      avgDaily: avgDaily.toFixed(2),
      projected: (avgDaily * daysInMonth).toFixed(1),
      daysLeft: daysInMonth - dayOfMonth,
      utilization: dayOfMonth > 0 ? (dayOfMonth / daysInMonth * 100).toFixed(0) : 0,
    },
  });
});

/**
 * Get traffic usage forecast based on current consumption rate.
 * @route GET /api/traffic-forecast
 * @returns {{ success: true, data: { remaining24h: string, monthlyProjected: string } }}
 */
app.get('/api/traffic-forecast', (req, res) => {
  const stats = sim.getStats();
  const hoursLeft = 24 - new Date().getHours();
  const currentRate = stats.today.totalGB / Math.max(1, new Date().getHours());
  const forecast = {
    remaining24h: (currentRate * hoursLeft).toFixed(1),
    monthlyProjected: (stats.month.totalGB / Math.max(1, new Date().getDate()) * 30).toFixed(1),
  };
  res.json({ success: true, data: forecast });
});

/**
 * Get anomaly detection results based on speed and latency thresholds.
 * @route GET /api/anomalies
 * @returns {{ success: true, data: Array<{ type: string, msg: string, severity: string }> }}
 */
app.get('/api/anomalies', (req, res) => {
  const anomalies = [];
  const speed = sim.getSpeed();
  if (speed.download < 1) anomalies.push({ type: 'low_speed', msg: 'Download speed abnormally low', severity: 'warning' });
  if (speed.download > 500) anomalies.push({ type: 'high_speed', msg: 'Download speed abnormally high', severity: 'info' });
  if (pingLatency > 200) anomalies.push({ type: 'high_latency', msg: 'Network latency too high', severity: 'warning' });
  if (pingLatency > 500) anomalies.push({ type: 'timeout', msg: 'Network may be disconnected', severity: 'error' });
  res.json({ success: true, data: anomalies });
});

// Traffic history log
/** @type {Array<{ time: string, download: number, upload: number, latency: number }>} */
const trafficLog = [];
setInterval(() => {
  const speed = sim.getSpeed();
  trafficLog.push({ time: new Date().toISOString(), download: speed.download, upload: speed.upload, latency: pingLatency });
  if (trafficLog.length > 8640) trafficLog.shift(); // 24h * 6 samples/min * 60 min
}, 10000);

/**
 * Get traffic history for the specified time window.
 * @route GET /api/history
 * @param {string} [req.query.hours=1] - Number of hours to look back
 * @returns {{ success: true, data: Array<object> }}
 */
app.get('/api/history', (req, res) => {
  const hours = parseInt(req.query.hours) || 1;
  const cutoff = Date.now() - hours * 3600 * 1000;
  res.json({ success: true, data: trafficLog.filter(d => new Date(d.time).getTime() > cutoff) });
});

// Application settings
/** @type {{ autoDark: boolean, notifications: boolean, compactMode: boolean, refreshInterval: number }} */
let appSettings = { autoDark: true, notifications: true, compactMode: false, refreshInterval: 1000 };

/**
 * Get application settings.
 * @route GET /api/settings
 * @returns {{ success: true, data: object }}
 */
app.get('/api/settings', (req, res) => res.json({ success: true, data: appSettings }));

/**
 * Update application settings. Only known keys with matching types are accepted.
 * @route POST /api/settings
 * @param {object} req.body - Partial settings to merge
 * @returns {{ success: true, data: object }}
 */
app.post('/api/settings', (req, res) => {
  if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body)) {
      if (k in appSettings && typeof v === typeof appSettings[k]) appSettings[k] = v;
    }
  }
  res.json({ success: true, data: appSettings });
});

// Threshold alert check
/** @type {{ traffic: boolean, balance: boolean }} */
let alertSent = { traffic: false, balance: false };

/**
 * Check traffic and balance against thresholds and broadcast alerts via SSE.
 * @private
 */
function checkAlerts() {
  const overview = sim.getOverview();
  const thresholds = sim.getThresholds();
  if (!overview.isUnlimited && overview.usedPercent > thresholds.trafficWarn && !alertSent.traffic) {
    alertSent.traffic = true;
    const msg = `Traffic usage exceeds ${thresholds.trafficWarn}%`;
    app.locals.broadcastSSE('alert', { type: 'traffic', msg, severity: 'warning' });
    alertHistory.push({ time: new Date().toISOString(), type: 'traffic', message: msg, severity: 'warning' });
    if (alertHistory.length > 500) alertHistory.shift();
  }
  if (overview.balance < thresholds.balanceWarn && overview.balance > 0 && !alertSent.balance) {
    alertSent.balance = true;
    const msg = `Balance below CNY ${thresholds.balanceWarn}`;
    app.locals.broadcastSSE('alert', { type: 'balance', msg, severity: 'warning' });
    alertHistory.push({ time: new Date().toISOString(), type: 'balance', message: msg, severity: 'warning' });
    if (alertHistory.length > 500) alertHistory.shift();
  }
}
setInterval(checkAlerts, 30000);

/**
 * Download a JSON backup of current settings, thresholds, and stats.
 * @route GET /api/backup
 * @returns {object} Backup data with exportTime
 */
app.get('/api/backup', (req, res) => {
  const data = { exportTime: new Date().toISOString(), settings: appSettings, thresholds: sim.getThresholds(), stats: sim.getStats() };
  res.setHeader('Content-Disposition', 'attachment; filename=caucnet-backup-' + new Date().toISOString().split('T')[0] + '.json');
  res.json(data);
});

/**
 * Generate a comprehensive usage report.
 * @route GET /api/report
 * @returns {{ success: true, data: object }}
 */
app.get('/api/report', (req, res) => {
  const stats = sim.getStats();
  const speed = sim.getSpeed();
  const quality = { latencyMs: pingLatency, quality: pingLatency < 20 ? 'excellent' : pingLatency < 50 ? 'good' : pingLatency < 100 ? 'fair' : 'poor' };
  const devices = sim.getDevices();
  res.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      today: stats.today,
      month: stats.month,
      currentSpeed: speed,
      quality,
      onlineDevices: devices.length,
      account: sim.account,
    },
  });
});

/**
 * Trigger a Cloudflare-based speed test (downloads 10 MB).
 * @route GET /api/speedtest
 * @returns {{ success: true, data: { speedMbps: number, bytes: number, elapsed: string } }}
 */
app.get('/api/speedtest', (req, res) => {
  const start = Date.now();
  https.get('https://speed.cloudflare.com/__down?bytes=10000000', (r) => {
    let bytes = 0;
    r.on('data', c => bytes += c.length);
    r.on('end', () => {
      const sec = (Date.now() - start) / 1000;
      res.json({ success: true, data: { speedMbps: parseFloat((bytes * 8 / sec / 1e6).toFixed(1)), bytes, elapsed: sec.toFixed(2) } });
    });
  }).on('error', e => res.json({ success: false, error: e.message }));
});

/**
 * Server health check endpoint.
 * @route GET /api/health
 * @returns {{ status: string, uptime: string, memory: number, timestamp: string }}
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime().toFixed(0), memory: process.memoryUsage().heapUsed, timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  const { version } = require('./package.json');
  console.log('');
  console.log('  +------------------------------------------+');
  console.log(`  |  CAUCNet Traffic v${version}                    |`);
  console.log(`  |  http://localhost:${PORT}                     |`);
  console.log('  +------------------------------------------+');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => { console.log('[Server] SIGTERM received, shutting down...'); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { console.log('[Server] SIGINT received, shutting down...'); server.close(() => process.exit(0)); });
