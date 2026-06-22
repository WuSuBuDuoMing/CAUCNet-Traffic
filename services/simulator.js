/**
 * CAUCNet Traffic -- Traffic Simulation & Data Engine
 *
 * Manages campus network traffic data with real NIC speed collection
 * (Windows PowerShell) and simulated data fallback. Provides real-time
 * speed, traffic statistics, device management, trend analysis, and
 * threshold configuration.
 *
 * @module services/simulator
 * @version 1.13.0
 * @author WuSuBuDuoMing
 * @license MIT
 */

const os = require('os');

/**
 * Traffic data engine -- collects real NIC stats via Windows PowerShell
 * and falls back to simulated data when unavailable.
 *
 * @class TrafficSimulator
 * @example
 * const sim = new TrafficSimulator();
 * setInterval(() => sim.tick(), 1000);
 * console.log(sim.getSpeed()); // { download: 45.23, upload: 12.11, ... }
 */
class TrafficSimulator {
  /**
   * Initialize the traffic simulator with default account, quota,
   * device, and statistical data.
   */
  constructor() {
    /**
     * Campus network account information.
     * Placeholder data; replaced at runtime with real login data.
     * @type {{ username: string, realName: string, campus: string, plan: string, balance: number, idLast4: string, phone: string }}
     */
    this.account = {
      username: '20**********',
      realName: 'Demo User',
      campus: 'Civil Aviation University of China',
      plan: 'Annual Unlimited',
      balance: 0,
      idLast4: '****',
      phone: '138****0000',
    };

    /**
     * Traffic quota configuration (unlimited plan).
     * @type {{ total: number, used: number, sessionUsed: number }}
     */
    this.quota = {
      total: Infinity,
      used: 0,
      sessionUsed: 0,
    };

    /**
     * Current speed readings in Mbps.
     * @type {{ download: number, upload: number, downloadPeak: number, uploadPeak: number }}
     */
    this.speed = {
      download: 0,
      upload: 0,
      downloadPeak: 0,
      uploadPeak: 0,
    };

    /**
     * Online device list (placeholder data).
     * @type {Array<{ id: string, name: string, mac: string, ip: string, type: string, active: boolean, joinTime: number, service: string, accessType: string }>}
     */
    this.devices = [
      { id: 'd1', name: 'iPhone', mac: 'AA:BB:**:**:**:**', ip: '10.102.*.***', type: 'phone', active: true, joinTime: Date.now() - 3600000 * 3, service: 'Default Service', accessType: 'Wireless' },
      { id: 'd2', name: 'PC (Wired)', mac: 'CC:DD:**:**:**:**', ip: '10.102.*.***', type: 'pc', active: true, joinTime: Date.now() - 3600000 * 28, service: 'Default Service', accessType: 'Wired' },
      { id: 'd3', name: 'Router', mac: 'EE:FF:**:**:**:**', ip: '10.102.*.***', type: 'router', active: true, joinTime: Date.now() - 3600000 * 12, service: '', accessType: 'Wired' },
    ];

    /**
     * Network connection info (placeholder).
     * @type {Array<{ ip: string, mac: string, accessType: string }>}
     */
    this.connections = [
      { ip: '10.***.***.***', mac: '**:**:**:**:**:**', accessType: 'Wired Portal' },
    ];

    /**
     * Today's traffic statistics.
     * @type {{ date: string, download: number, upload: number, peakDownload: number, sessionCount: number }}
     */
    this.todayStats = {
      date: new Date().toISOString().split('T')[0],
      download: 2.3 * 1024 * 1024 * 1024,
      upload: 0.8 * 1024 * 1024 * 1024,
      peakDownload: 12.5 * 1024 * 1024,
      sessionCount: 3,
    };

    /**
     * Monthly traffic statistics.
     * @type {{ month: string, download: number, upload: number, avgDaily: number }}
     */
    this.monthStats = {
      month: new Date().toISOString().slice(0, 7),
      download: 15.2 * 1024 * 1024 * 1024,
      upload: 3.5 * 1024 * 1024 * 1024,
      avgDaily: 0.63 * 1024 * 1024 * 1024,
    };

    /**
     * Traffic trend history (real-time accumulation).
     * @type {Array<{ time: string, hour: number, download: number, upload: number }>}
     */
    this.trafficHistory = this._generateTrend();
    /** @private */ this._lastSampleTime = Date.now();
    /** @private */ this._sampleInterval = 60000;

    /**
     * Threshold alert settings.
     * @type {{ trafficWarn: number, balanceWarn: number, speedMin: number }}
     */
    this.thresholds = {
      trafficWarn: 80,
      balanceWarn: 10,
      speedMin: 0.5,
    };

    /**
     * Campus network login status.
     * @type {{ loggedIn: boolean, loginTime: number, expiresAt: number|null, ip: string, nasIp: string, accessType: string }}
     */
    this.loginStatus = {
      loggedIn: true,
      loginTime: Date.now() - 3600000 * 3,
      expiresAt: null,
      ip: '10.***.***.***',
      nasIp: '10.***.***.***',
      accessType: 'Wired Portal',
    };

    /** @private Session start timestamp */
    this.sessionStart = Date.now();
  }

  /**
   * Generate initial 24-hour trend data with simulated day/night patterns.
   * @private
   * @returns {Array<{ time: string, hour: number, download: number, upload: number }>}
   */
  _generateTrend() {
    const trend = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now);
      h.setHours(h.getHours() - i, 0, 0, 0);
      const hour = h.getHours();
      let base = 50;
      if (hour >= 8 && hour <= 12) base = 300;
      else if (hour >= 14 && hour <= 18) base = 250;
      else if (hour >= 19 && hour <= 23) base = 400;
      else if (hour >= 0 && hour <= 6) base = 20;

      const jitter = Math.random() * base * 0.4;
      trend.push({
        time: `${String(hour).padStart(2, '0')}:00`,
        hour,
        download: Math.floor(base + jitter),
        upload: Math.floor((base + jitter) * 0.3),
      });
    }
    return trend;
  }

  /**
   * Fetch real NIC traffic statistics via Windows PowerShell.
   * Caches results for 3 seconds; uses exponential backoff on failure
   * (up to 30 seconds).
   *
   * @private
   * @returns {{ rx: number, tx: number } | null} Cumulative bytes received/sent, or null on failure
   */
  _getRealTrafficStats() {
    const now = Date.now();
    const ttl = this._trafficFailed ? Math.min(30000, this._trafficFailed * 3000) : 3000;
    if (this._trafficCache && (now - this._trafficCacheTime) < ttl) {
      return this._trafficCache;
    }
    try {
      const { execSync } = require('child_process');
      const cmd = 'powershell -NoProfile -Command "Get-NetAdapterStatistics | Select-Object ReceivedBytes,SentBytes | ConvertTo-Json"';
      const raw = execSync(cmd, { encoding: 'utf-8', timeout: 3000, windowsHide: true });
      const adapters = JSON.parse(raw);
      const arr = Array.isArray(adapters) ? adapters : [adapters];
      let totalRx = 0, totalTx = 0;
      for (const a of arr) {
        totalRx += a.ReceivedBytes || 0;
        totalTx += a.SentBytes || 0;
      }
      this._trafficCache = { rx: totalRx, tx: totalTx };
      this._trafficCacheTime = now;
      this._trafficFailed = 0;
      return this._trafficCache;
    } catch (e) {
      this._trafficFailed = (this._trafficFailed || 0) + 1;
      return this._trafficCache || null;
    }
  }

  /**
   * Advance one tick -- reads NIC counters and updates speed/traffic stats.
   * Falls back to simulated data on first call or when PowerShell fails.
   * Called every second by the SSE broadcast loop.
   */
  tick() {
    const stats = this._getRealTrafficStats();
    if (stats && this._lastTraffic) {
      const dt = (Date.now() - this._lastTrafficTime) / 1000;
      if (dt > 0) {
        const rxDelta = stats.rx - this._lastTraffic.rx;
        const txDelta = stats.tx - this._lastTraffic.tx;
        // bytes/s -> Mbps
        this.speed.download = Math.max(0, (rxDelta / dt) * 8 / (1024 * 1024));
        this.speed.upload = Math.max(0, (txDelta / dt) * 8 / (1024 * 1024));
        this.speed.downloadPeak = Math.max(this.speed.downloadPeak, this.speed.download);
        this.speed.uploadPeak = Math.max(this.speed.uploadPeak, this.speed.upload);
        const dlBytes = Math.max(0, rxDelta);
        const ulBytes = Math.max(0, txDelta);
        this.quota.sessionUsed += dlBytes + ulBytes;
        this.todayStats.download += dlBytes;
        this.todayStats.upload += ulBytes;
        this.monthStats.download += dlBytes;
        this.monthStats.upload += ulBytes;
      }
    } else {
      // Fallback: simulated data
      const isDaytime = (() => {
        const h = new Date().getHours();
        return h >= 8 && h <= 23;
      })();
      const baseSpeed = isDaytime ? 30 + Math.random() * 70 : 5 + Math.random() * 15;
      this.speed.download = Math.max(0.1, baseSpeed + (Math.random() - 0.5) * 20);
      this.speed.upload = Math.max(0.05, baseSpeed * 0.25 + (Math.random() - 0.5) * 5);
      this.speed.downloadPeak = Math.max(this.speed.downloadPeak, this.speed.download);
      this.speed.uploadPeak = Math.max(this.speed.uploadPeak, this.speed.upload);
      const dlBytes = this.speed.download * 1024 * 1024 / 8;
      const ulBytes = this.speed.upload * 1024 * 1024 / 8;
      this.quota.sessionUsed += dlBytes + ulBytes;
      this.todayStats.download += dlBytes;
      this.todayStats.upload += ulBytes;
      this.monthStats.download += dlBytes;
      this.monthStats.upload += ulBytes;
    }
    this._lastTraffic = stats;
    this._lastTrafficTime = Date.now();

    // Sample one trend data point per minute
    if (Date.now() - this._lastSampleTime >= this._sampleInterval) {
      const now = new Date();
      const hour = now.getHours();
      this.trafficHistory.push({
        time: `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        hour,
        download: Math.round(this.speed.download * 10) / 10,
        upload: Math.round(this.speed.upload * 10) / 10,
      });
      if (this.trafficHistory.length > 1440) {
        this.trafficHistory.shift();
      }
      this._lastSampleTime = Date.now();
    }
  }

  /**
   * Get current upload/download speed in Mbps with peak values.
   * @returns {{ download: number, upload: number, downloadPeak: number, uploadPeak: number }}
   */
  getSpeed() {
    return {
      download: Math.round(this.speed.download * 100) / 100,
      upload: Math.round(this.speed.upload * 100) / 100,
      downloadPeak: Math.round(this.speed.downloadPeak * 100) / 100,
      uploadPeak: Math.round(this.speed.uploadPeak * 100) / 100,
    };
  }

  /**
   * Get traffic overview including account info, usage, and session duration.
   * @returns {{ account: object, isUnlimited: boolean, usedBytes: number, totalBytes: number, usedGB: number, totalGB: number, remainingGB: number, usedPercent: number, balance: number, sessionUsedMB: number, sessionDuration: number }}
   */
  getOverview() {
    const isUnlimited = this.quota.total === Infinity;
    const usedPercent = isUnlimited ? 0 : (this.quota.used / this.quota.total * 100);
    const remaining = isUnlimited ? Infinity : this.quota.total - this.quota.used;
    return {
      account: this.account,
      isUnlimited,
      usedBytes: this.quota.used,
      totalBytes: this.quota.total,
      usedGB: isUnlimited ? 0 : Math.round(this.quota.used / (1024 ** 3) * 100) / 100,
      totalGB: isUnlimited ? 0 : Math.round(this.quota.total / (1024 ** 3) * 100) / 100,
      remainingGB: isUnlimited ? 0 : Math.round(remaining / (1024 ** 3) * 100) / 100,
      usedPercent: Math.round(usedPercent * 10) / 10,
      balance: this.account.balance,
      sessionUsedMB: Math.round(this.quota.sessionUsed / (1024 ** 2) * 10) / 10,
      sessionDuration: Math.floor((Date.now() - this.sessionStart) / 1000),
    };
  }

  /**
   * Get list of active online devices with masked MAC/IP addresses.
   * @returns {Array<{ id: string, name: string, mac: string, ip: string, type: string, active: boolean, joinTime: number, joinDuration: number, maskedMac: string, maskedIp: string }>}
   */
  getDevices() {
    return this.devices.filter(d => d.active).map(d => ({
      ...d,
      joinDuration: Math.floor((Date.now() - d.joinTime) / 1000),
      maskedMac: d.mac.slice(0, 5) + '**:**:**',
      maskedIp: d.ip && d.ip !== '--' ? d.ip.replace(/(\d+)$/, '**') : d.ip,
    }));
  }

  /**
   * Logout (deactivate) a device by ID.
   * @param {string} id - Device ID to deactivate
   * @returns {boolean} True if device was found and deactivated
   */
  logoutDevice(id) {
    const d = this.devices.find(d => d.id === id);
    if (d) { d.active = false; return true; }
    return false;
  }

  /**
   * Get today and month traffic statistics with automatic date rollover.
   * Resets today's stats on date change; resets month stats on month change.
   * @returns {{ today: { date: string, downloadGB: number, uploadGB: number, totalGB: number, peakMbps: number }, month: { month: string, downloadGB: number, uploadGB: number, totalGB: number, avgDailyGB: number } }}
   */
  getStats() {
    const today = new Date().toISOString().split('T')[0];
    if (this.todayStats.date !== today) {
      this.todayStats = { date: today, download: 0, upload: 0, peakDownload: 0, sessionCount: 0 };
    }
    const thisMonth = new Date().toISOString().slice(0, 7);
    if (this.monthStats.month !== thisMonth) {
      this.monthStats = { month: thisMonth, download: 0, upload: 0, avgDaily: 0 };
    }
    return {
      today: {
        date: this.todayStats.date,
        downloadGB: Math.round(this.todayStats.download / (1024 ** 3) * 100) / 100,
        uploadGB: Math.round(this.todayStats.upload / (1024 ** 3) * 100) / 100,
        totalGB: Math.round((this.todayStats.download + this.todayStats.upload) / (1024 ** 3) * 100) / 100,
        peakMbps: Math.round(this.todayStats.peakDownload / (1024 ** 2) * 10) / 10,
      },
      month: {
        month: this.monthStats.month,
        downloadGB: Math.round(this.monthStats.download / (1024 ** 3) * 100) / 100,
        uploadGB: Math.round(this.monthStats.upload / (1024 ** 3) * 100) / 100,
        totalGB: Math.round((this.monthStats.download + this.monthStats.upload) / (1024 ** 3) * 100) / 100,
        avgDailyGB: Math.round(this.monthStats.avgDaily / (1024 ** 3) * 100) / 100,
      },
    };
  }

  /**
   * Get the last 60 trend data points (covering the most recent ~60 minutes).
   * @returns {Array<{ time: string, hour: number, download: number, upload: number }>}
   */
  getTrend() { return this.trafficHistory.slice(-60); }

  /**
   * Get current threshold settings.
   * @returns {{ trafficWarn: number, balanceWarn: number, speedMin: number }}
   */
  getThresholds() { return this.thresholds; }

  /**
   * Merge new threshold values into current settings.
   * @param {Partial<{ trafficWarn: number, balanceWarn: number, speedMin: number }>} t - Threshold overrides
   */
  setThresholds(t) { Object.assign(this.thresholds, t); }

  /**
   * Get current campus network login status.
   * @returns {{ loggedIn: boolean, loginTime: number, expiresAt: number|null, ip: string, nasIp: string, accessType: string }}
   */
  getLoginStatus() { return this.loginStatus; }
}

module.exports = { TrafficSimulator };
