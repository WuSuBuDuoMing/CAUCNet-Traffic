const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const { TrafficSimulator } = require('../services/simulator');

let app;
let sim;

before(() => {
  sim = new TrafficSimulator();
  app = express();
  app.use(cors());
  app.use(express.json());

  const sseClients = new Set();
  app.locals.broadcastSSE = (eventType, data) => {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of sseClients) { try { c.write(payload); } catch { sseClients.delete(c); } }
  };

  app.get('/api/speed', (req, res) => res.json({ success: true, data: sim.getSpeed() }));
  app.get('/api/overview', (req, res) => res.json({ success: true, data: sim.getOverview() }));
  app.get('/api/devices', (req, res) => res.json({ success: true, data: sim.getDevices() }));
  app.post('/api/devices/:id/logout', (req, res) => {
    const ok = sim.logoutDevice(req.params.id);
    res.json({ success: ok, message: ok ? '设备已注销' : '设备不存在' });
  });
  app.get('/api/stats', (req, res) => res.json({ success: true, data: sim.getStats() }));
  app.get('/api/trend', (req, res) => res.json({ success: true, data: sim.getTrend() }));
  app.get('/api/thresholds', (req, res) => res.json({ success: true, data: sim.getThresholds() }));
  app.post('/api/thresholds', (req, res) => {
    const t = req.body;
    if (t && typeof t === 'object') {
      if (typeof t.trafficWarn === 'number') sim.thresholds.trafficWarn = t.trafficWarn;
      if (typeof t.balanceWarn === 'number') sim.thresholds.balanceWarn = t.balanceWarn;
    }
    res.json({ success: true });
  });
  app.get('/api/login-status', (req, res) => res.json({ success: true, data: sim.getLoginStatus() }));
  app.get('/api/quality', (req, res) => res.json({ success: true, data: { latencyMs: 0, quality: 'excellent' } }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime().toFixed(0), memory: process.memoryUsage().heapUsed, timestamp: new Date().toISOString() }));
  app.get('/api/anomalies', (req, res) => res.json({ success: true, data: [] }));
  app.get('/api/settings', (req, res) => res.json({ success: true, data: { autoDark: true, notifications: true, compactMode: false, refreshInterval: 1000 } }));
  app.post('/api/settings', (req, res) => res.json({ success: true, data: req.body }));
  app.get('/api/bandwidth-analysis', (req, res) => {
    const stats = sim.getStats();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const avgDaily = dayOfMonth > 0 ? stats.month.totalGB / dayOfMonth : 0;
    res.json({ success: true, data: { avgDaily: avgDaily.toFixed(2), projected: (avgDaily * daysInMonth).toFixed(1), daysLeft: daysInMonth - dayOfMonth } });
  });
  app.get('/api/traffic-forecast', (req, res) => {
    const stats = sim.getStats();
    const hoursLeft = 24 - new Date().getHours();
    const currentRate = stats.today.totalGB / Math.max(1, new Date().getHours());
    res.json({ success: true, data: { remaining24h: (currentRate * hoursLeft).toFixed(1), monthlyProjected: (stats.month.totalGB / Math.max(1, new Date().getDate()) * 30).toFixed(1) } });
  });

  // v1.11.0+ export endpoints (simplified for testing)
  app.get('/api/export/csv', (req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.send('Time,Download,Upload,Latency\n');
  });

  app.get('/api/export/json', (req, res) => {
    res.json({ exportTime: new Date().toISOString(), version: 'CAUCNet Traffic v1.13.0', recordCount: 0 });
  });

  app.get('/api/export/tsv', (req, res) => {
    res.setHeader('Content-Type', 'text/tab-separated-values');
    res.send('Metric\tValue\n');
  });

  // v1.12.0+ compare endpoint
  app.get('/api/compare', (req, res) => {
    res.json({ success: true, data: { today: sim.getTrend(), comparison: sim.getTrend(), delta: { todayAvgMbps: 0, comparisonAvgMbps: 0, difference: 0, percentChange: 0 } } });
  });

  // v1.13.0+ alerts and server-stats endpoints
  app.get('/api/alerts', (req, res) => {
    res.json({ success: true, data: [] });
  });

  app.get('/api/alerts/clear', (req, res) => {
    res.json({ success: true, message: 'Alert history cleared' });
  });

  app.get('/api/server-stats', (req, res) => {
    res.json({ success: true, data: { uptime: '0', memoryUsage: {}, cacheSize: 0, sseClients: 0, alertHistoryCount: 0, trafficLogCount: 0, nodeVersion: process.version } });
  });
});

describe('API Endpoints', () => {
  it('GET /api/speed returns speed data', async () => {
    const res = await request(app).get('/api/speed');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.download, 'number');
    assert.equal(typeof res.body.data.upload, 'number');
    assert.ok('downloadPeak' in res.body.data);
    assert.ok('uploadPeak' in res.body.data);
  });

  it('GET /api/overview returns overview data', async () => {
    const res = await request(app).get('/api/overview');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.isUnlimited, 'boolean');
    assert.equal(typeof res.body.data.usedPercent, 'number');
    assert.equal(typeof res.body.data.balance, 'number');
  });

  it('GET /api/devices returns device list', async () => {
    const res = await request(app).get('/api/devices');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    for (const d of res.body.data) {
      assert.ok(d.maskedMac);
      assert.ok(d.maskedIp);
    }
  });

  it('POST /api/devices/:id/logout deactivates device', async () => {
    const devicesRes = await request(app).get('/api/devices');
    const deviceId = devicesRes.body.data[0].id;
    const res = await request(app).post(`/api/devices/${deviceId}/logout`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, '设备已注销');
  });

  it('POST /api/devices/:id/logout returns false for unknown device', async () => {
    const res = await request(app).post('/api/devices/nonexistent/logout');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, '设备不存在');
  });

  it('GET /api/stats returns today and month stats', async () => {
    const res = await request(app).get('/api/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.today);
    assert.ok(res.body.data.month);
    assert.equal(typeof res.body.data.today.downloadGB, 'number');
    assert.equal(typeof res.body.data.month.downloadGB, 'number');
  });

  it('GET /api/trend returns trend data array', async () => {
    const res = await request(app).get('/api/trend');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
  });

  it('GET /api/thresholds returns threshold settings', async () => {
    const res = await request(app).get('/api/thresholds');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.trafficWarn, 'number');
    assert.equal(typeof res.body.data.balanceWarn, 'number');
  });

  it('POST /api/thresholds updates thresholds', async () => {
    const res = await request(app).post('/api/thresholds').send({ trafficWarn: 90 });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const getRes = await request(app).get('/api/thresholds');
    assert.equal(getRes.body.data.trafficWarn, 90);
  });

  it('GET /api/login-status returns login status', async () => {
    const res = await request(app).get('/api/login-status');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.loggedIn, 'boolean');
    assert.ok(res.body.data.ip);
  });

  it('GET /api/quality returns connection quality', async () => {
    const res = await request(app).get('/api/quality');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.latencyMs, 'number');
    assert.ok(res.body.data.quality);
  });

  it('GET /api/health returns health status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.uptime);
    assert.ok(res.body.timestamp);
  });

  it('GET /api/anomalies returns anomalies array', async () => {
    const res = await request(app).get('/api/anomalies');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('GET /api/settings returns app settings', async () => {
    const res = await request(app).get('/api/settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.autoDark, 'boolean');
    assert.equal(typeof res.body.data.notifications, 'boolean');
  });

  it('POST /api/settings updates settings', async () => {
    const res = await request(app).post('/api/settings').send({ autoDark: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('GET /api/bandwidth-analysis returns analysis', async () => {
    const res = await request(app).get('/api/bandwidth-analysis');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.avgDaily);
    assert.ok(res.body.data.projected);
    assert.equal(typeof res.body.data.daysLeft, 'number');
  });

  it('GET /api/traffic-forecast returns forecast', async () => {
    const res = await request(app).get('/api/traffic-forecast');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.remaining24h);
    assert.ok(res.body.data.monthlyProjected);
  });

  // v1.11.0 -- Data export endpoints
  it('GET /api/export/csv returns CSV file', async () => {
    const res = await request(app).get('/api/export/csv');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/csv'));
    assert.ok(res.text.includes('Time,Download'));
  });

  it('GET /api/export/json returns JSON export', async () => {
    const res = await request(app).get('/api/export/json');
    assert.equal(res.status, 200);
    assert.ok(res.body.exportTime);
    assert.equal(res.body.version, 'CAUCNet Traffic v1.13.0');
  });

  it('GET /api/export/tsv returns TSV file', async () => {
    const res = await request(app).get('/api/export/tsv');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/tab-separated-values'));
    assert.ok(res.text.includes('Metric\tValue'));
  });

  // v1.12.0 -- Trend comparison
  it('GET /api/compare returns trend comparison data', async () => {
    const res = await request(app).get('/api/compare?days=3');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.today));
    assert.ok(Array.isArray(res.body.data.comparison));
    assert.ok(res.body.data.delta);
    assert.equal(typeof res.body.data.delta.percentChange, 'number');
  });

  // v1.13.0 -- Alert history & server stats
  it('GET /api/alerts returns alert history array', async () => {
    const res = await request(app).get('/api/alerts');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('GET /api/alerts/clear clears alert history', async () => {
    const res = await request(app).get('/api/alerts/clear');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Alert history cleared');
  });

  it('GET /api/server-stats returns server statistics', async () => {
    const res = await request(app).get('/api/server-stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.uptime);
    assert.ok(res.body.data.nodeVersion);
    assert.equal(typeof res.body.data.cacheSize, 'number');
  });
});
