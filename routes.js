/**
 * CAUCNet Traffic - API Router
 * Extracted from server.js for integration with root portal
 */

const express = require('express');
const router = express.Router();
const { TrafficSimulator } = require('./services/simulator');

const sim = new TrafficSimulator();

// Real-time speed
router.get('/speed', (req, res) => {
  res.json({ success: true, data: sim.getSpeed() });
});

// Traffic overview
router.get('/overview', (req, res) => {
  res.json({ success: true, data: sim.getOverview() });
});

// Online devices
router.get('/devices', (req, res) => {
  res.json({ success: true, data: sim.getDevices() });
});

// Logout device
router.post('/devices/:id/logout', (req, res) => {
  const ok = sim.logoutDevice(req.params.id);
  res.json({ success: ok, message: ok ? '设备已注销' : '设备不存在' });
});

// Today/month stats
router.get('/stats', (req, res) => {
  res.json({ success: true, data: sim.getStats() });
});

// Traffic trend (last 24h)
router.get('/trend', (req, res) => {
  res.json({ success: true, data: sim.getTrend() });
});

// Threshold settings
router.get('/thresholds', (req, res) => {
  res.json({ success: true, data: sim.getThresholds() });
});

router.post('/thresholds', (req, res) => {
  sim.setThresholds(req.body);
  res.json({ success: true });
});

// Login status
router.get('/login-status', (req, res) => {
  res.json({ success: true, data: sim.getLoginStatus() });
});

module.exports = { router, simulator: sim };
