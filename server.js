/**
 * CAUCNet Traffic — 校园网流量助手 Express 服务端
 * 提供 REST API 和 SSE 实时推送
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { TrafficSimulator } = require('./services/simulator');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

// R81-R88: 安全头 + 请求日志
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (req.path.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// R94: 静态文件缓存
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

// ============================
// 模拟数据引擎
// ============================
const sim = new TrafficSimulator();

// ============================
// SSE 客户端
// ============================
const sseClients = new Set();

app.locals.broadcastSSE = (eventType, data) => {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) { try { c.write(payload); } catch { sseClients.delete(c); } }
};

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

// 实时速度
app.get('/api/speed', (req, res) => {
  res.json({ success: true, data: sim.getSpeed() });
});

// 流量概览
app.get('/api/overview', (req, res) => {
  res.json({ success: true, data: sim.getOverview() });
});

// 在线设备
app.get('/api/devices', (req, res) => {
  res.json({ success: true, data: sim.getDevices() });
});

// 注销设备
app.post('/api/devices/:id/logout', (req, res) => {
  const ok = sim.logoutDevice(req.params.id);
  if (ok) {
    // 广播设备列表更新
    app.locals.broadcastSSE('device_update', { devices: sim.getDevices() });
  }
  res.json({ success: ok, message: ok ? '设备已注销' : '设备不存在' });
});

// 今日/本月统计
app.get('/api/stats', (req, res) => {
  res.json({ success: true, data: sim.getStats() });
});

// 流量趋势（最近24小时）
app.get('/api/trend', (req, res) => {
  res.json({ success: true, data: sim.getTrend() });
});

// 阈值设置
app.get('/api/thresholds', (req, res) => {
  res.json({ success: true, data: sim.getThresholds() });
});

app.post('/api/thresholds', (req, res) => {
  const t = req.body;
  if (t && typeof t === 'object') {
    if (typeof t.trafficWarn === 'number') sim.thresholds.trafficWarn = t.trafficWarn;
    if (typeof t.balanceWarn === 'number') sim.thresholds.balanceWarn = t.balanceWarn;
  }
  res.json({ success: true });
});

// 登录状态
app.get('/api/login-status', (req, res) => {
  res.json({ success: true, data: sim.getLoginStatus() });
});

// ============================
// SSE 推送循环
// ============================
setInterval(() => {
  sim.tick();
  const broadcast = app.locals.broadcastSSE;
  broadcast('speed_update', sim.getSpeed());
  broadcast('overview_update', sim.getOverview());
  // 同步推送统计和趋势（与 tick 原子一致）
  broadcast('stats_update', sim.getStats());
  broadcast('trend_update', sim.getTrend());
}, 1000);

// ============================
// 连接质量 — ping 延迟
let pingLatency = 0;
setInterval(() => {
  const start = Date.now();
  const net = require('net');
  const socket = new net.Socket();
  socket.setTimeout(2000);
  socket.connect(80, '10.80.80.250', () => {
    pingLatency = Date.now() - start;
    socket.destroy();
  });
  socket.on('error', () => { pingLatency = 999; socket.destroy(); });
  socket.on('timeout', () => { pingLatency = 999; socket.destroy(); });
}, 5000);

app.get('/api/quality', (req, res) => {
  res.json({ success: true, data: { latencyMs: pingLatency, quality: pingLatency < 20 ? 'excellent' : pingLatency < 50 ? 'good' : pingLatency < 100 ? 'fair' : 'poor' } });
});

// R31: 网络适配器信息
app.get('/api/network-info', (req, res) => {
  try {
    const { execSync } = require('child_process');
    const raw = execSync('powershell -NoProfile -Command "Get-NetAdapter | Where-Object {$_.Status -eq \\"Up\\"} | Select-Object Name,InterfaceDescription,LinkSpeed,MacAddress | ConvertTo-Json"', { encoding: 'utf-8', timeout: 5000, windowsHide: true });
    const adapters = JSON.parse(raw);
    res.json({ success: true, data: Array.isArray(adapters) ? adapters : [adapters] });
  } catch { res.json({ success: true, data: [] }); }
});

// R32: IP 地理位置
app.get('/api/ip-info', (req, res) => {
  const https = require('https');
  https.get('https://ipinfo.io/json', (r) => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => {
      try { res.json({ success: true, data: JSON.parse(d) }); } catch { res.json({ success: false }); }
    });
  }).on('error', () => res.json({ success: false }));
});

// R33: 带宽分析
app.get('/api/bandwidth-analysis', (req, res) => {
  const stats = sim.getStats();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  const avgDaily = dayOfMonth > 0 ? stats.month.totalGB / dayOfMonth : 0;
  res.json({ success: true, data: { avgDaily: avgDaily.toFixed(2), projected: (avgDaily * daysInMonth).toFixed(1), daysLeft: daysInMonth - dayOfMonth, utilization: dayOfMonth > 0 ? (dayOfMonth / daysInMonth * 100).toFixed(0) : 0 } });
});

// R34: 流量预测
app.get('/api/traffic-forecast', (req, res) => {
  const stats = sim.getStats();
  const hoursLeft = 24 - new Date().getHours();
  const currentRate = stats.today.totalGB / Math.max(1, new Date().getHours());
  const forecast = { remaining24h: (currentRate * hoursLeft).toFixed(1), monthlyProjected: (stats.month.totalGB / Math.max(1, new Date().getDate()) * 30).toFixed(1) };
  res.json({ success: true, data: forecast });
});

// R35: 异常检测
app.get('/api/anomalies', (req, res) => {
  const anomalies = [];
  const speed = sim.getSpeed();
  if (speed.download < 1) anomalies.push({ type: 'low_speed', msg: '下载速度异常低', severity: 'warning' });
  if (speed.download > 500) anomalies.push({ type: 'high_speed', msg: '下载速度异常高', severity: 'info' });
  if (pingLatency > 200) anomalies.push({ type: 'high_latency', msg: '网络延迟过高', severity: 'warning' });
  if (pingLatency > 500) anomalies.push({ type: 'timeout', msg: '网络可能中断', severity: 'error' });
  res.json({ success: true, data: anomalies });
});

// R36: 历史记录
const trafficLog = [];
setInterval(() => {
  const speed = sim.getSpeed();
  trafficLog.push({ time: new Date().toISOString(), download: speed.download, upload: speed.upload, latency: pingLatency });
  if (trafficLog.length > 8640) trafficLog.shift(); // 24h * 6 * 60s
}, 10000);
app.get('/api/history', (req, res) => {
  const hours = parseInt(req.query.hours) || 1;
  const cutoff = Date.now() - hours * 3600 * 1000;
  res.json({ success: true, data: trafficLog.filter(d => new Date(d.time).getTime() > cutoff) });
});

// R37: 设置
let appSettings = { autoDark: true, notifications: true, compactMode: false, refreshInterval: 1000 };
app.get('/api/settings', (req, res) => res.json({ success: true, data: appSettings }));
app.post('/api/settings', (req, res) => {
  if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body)) {
      if (k in appSettings && typeof v === typeof appSettings[k]) appSettings[k] = v;
    }
  }
  res.json({ success: true, data: appSettings });
});

// R38: 通知（阈值告警）
let alertSent = { traffic: false, balance: false };
function checkAlerts() {
  const overview = sim.getOverview();
  const thresholds = sim.getThresholds();
  if (!overview.isUnlimited && overview.usedPercent > thresholds.trafficWarn && !alertSent.traffic) {
    alertSent.traffic = true;
    app.locals.broadcastSSE('alert', { type: 'traffic', msg: '流量使用超过 ' + thresholds.trafficWarn + '%', severity: 'warning' });
  }
  if (overview.balance < thresholds.balanceWarn && overview.balance > 0 && !alertSent.balance) {
    alertSent.balance = true;
    app.locals.broadcastSSE('alert', { type: 'balance', msg: '余额低于 ¥' + thresholds.balanceWarn, severity: 'warning' });
  }
}
setInterval(checkAlerts, 30000);

// R39: 数据备份/恢复
app.get('/api/backup', (req, res) => {
  const data = { exportTime: new Date().toISOString(), settings: appSettings, thresholds: sim.getThresholds(), stats: sim.getStats() };
  res.setHeader('Content-Disposition', 'attachment; filename=caucnet-backup-' + new Date().toISOString().split('T')[0] + '.json');
  res.json(data);
});

// R40: 使用报告
app.get('/api/report', (req, res) => {
  const stats = sim.getStats();
  const speed = sim.getSpeed();
  const quality = { latencyMs: pingLatency, quality: pingLatency < 20 ? 'excellent' : pingLatency < 50 ? 'good' : pingLatency < 100 ? 'fair' : 'poor' };
  const devices = sim.getDevices();
  res.json({ success: true, data: { generatedAt: new Date().toISOString(), today: stats.today, month: stats.month, currentSpeed: speed, quality, onlineDevices: devices.length, account: sim.account } });
});

// 测速工具
app.get('/api/speedtest', (req, res) => {
  const https = require('https');
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

// R85: 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime().toFixed(0), memory: process.memoryUsage().heapUsed, timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║     🌐 CAUCNet Traffic v1.0.0             ║');
  console.log('  ║     校园网流量助手                        ║');
  console.log(`  ║     http://localhost:${PORT}                ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

// R97: 优雅关闭
process.on('SIGTERM', () => { console.log('[Server] SIGTERM received, shutting down...'); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { console.log('[Server] SIGINT received, shutting down...'); server.close(() => process.exit(0)); });
