/**
 * CAUCNet Traffic - 流量模拟引擎
 * 真实用户数据 + 系统网卡速度采集
 */

const os = require('os');

class TrafficSimulator {
  constructor() {
    // 账户信息（示例数据，运行时会被真实登录数据替换）
    this.account = {
      username: '20**********',
      realName: '示例用户',
      campus: '中国民航大学',
      plan: '电信包年 · 不限流',
      balance: 0,
      idLast4: '****',
      phone: '138****0000',
    };

    // 流量配额（不限流套餐）
    this.quota = {
      total: Infinity,
      used: 0, // 不限流，不统计总量
      sessionUsed: 0,
    };

    // 速度（模拟）
    this.speed = {
      download: 0,
      upload: 0,
      downloadPeak: 0,
      uploadPeak: 0,
    };

    // 在线设备（示例数据，运行时会从校园网 API 获取真实数据）
    this.devices = [
      { id: 'd1', name: 'iPhone', mac: 'AA:BB:**:**:**:**', ip: '10.102.*.***', type: 'phone', active: true, joinTime: Date.now() - 3600000 * 3, service: '套餐默认服务', accessType: '无线' },
      { id: 'd2', name: '电脑 有线', mac: 'CC:DD:**:**:**:**', ip: '10.102.*.***', type: 'pc', active: true, joinTime: Date.now() - 3600000 * 28, service: '套餐默认服务', accessType: '有线' },
      { id: 'd3', name: '路由器', mac: 'EE:FF:**:**:**:**', ip: '10.102.*.***', type: 'router', active: true, joinTime: Date.now() - 3600000 * 12, service: '', accessType: '有线' },
    ];

    // 网络连接信息（示例数据）
    this.connections = [
      { ip: '10.***.***.***', mac: '**:**:**:**:**:**', accessType: '有线标准Portal接入' },
    ];

    // 今日统计
    this.todayStats = {
      date: new Date().toISOString().split('T')[0],
      download: 2.3 * 1024 * 1024 * 1024,
      upload: 0.8 * 1024 * 1024 * 1024,
      peakDownload: 12.5 * 1024 * 1024,
      sessionCount: 3,
    };

    // 本月统计
    this.monthStats = {
      month: new Date().toISOString().slice(0, 7),
      download: 15.2 * 1024 * 1024 * 1024,
      upload: 3.5 * 1024 * 1024 * 1024,
      avgDaily: 0.63 * 1024 * 1024 * 1024,
    };

    // 趋势数据（实时累积）
    this.trafficHistory = this._generateTrend(); // 初始模拟数据
    this._lastSampleTime = Date.now();
    this._sampleInterval = 60000; // 每分钟采样一次

    // 阈值设置
    this.thresholds = {
      trafficWarn: 80,    // 流量使用百分比警告
      balanceWarn: 10,    // 余额警告（元）
      speedMin: 0.5,      // 最低速度警告（Mbps）
    };

    // 登录状态（示例数据）
    this.loginStatus = {
      loggedIn: true,
      loginTime: Date.now() - 3600000 * 3,
      expiresAt: null, // 不限流套餐无到期时间
      ip: '10.***.***.***',
      nasIp: '10.***.***.***',
      accessType: '有线标准Portal接入',
    };

    // 会话起始时间
    this.sessionStart = Date.now();
  }

  _generateTrend() {
    const trend = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now);
      h.setHours(h.getHours() - i, 0, 0, 0);
      const hour = h.getHours();
      // 模拟白天高、夜间低
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
   * 获取真实网卡流量统计 (Windows PowerShell)
   * 缓存 3 秒，失败时指数退避重试（最多 30 秒）
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
      this._trafficFailed = 0; // 重置失败计数
      return this._trafficCache;
    } catch (e) {
      this._trafficFailed = (this._trafficFailed || 0) + 1;
      return this._trafficCache || null;
    }
  }

  tick() {
    // 读取真实网卡流量计数器，计算实际速度
    const stats = this._getRealTrafficStats();
    if (stats && this._lastTraffic) {
      const dt = (Date.now() - this._lastTrafficTime) / 1000; // 秒
      if (dt > 0) {
        const rxDelta = stats.rx - this._lastTraffic.rx;
        const txDelta = stats.tx - this._lastTraffic.tx;
        // bytes/s -> Mbps
        this.speed.download = Math.max(0, (rxDelta / dt) * 8 / (1024 * 1024));
        this.speed.upload = Math.max(0, (txDelta / dt) * 8 / (1024 * 1024));
        this.speed.downloadPeak = Math.max(this.speed.downloadPeak, this.speed.download);
        this.speed.uploadPeak = Math.max(this.speed.uploadPeak, this.speed.upload);
        // 累计流量（基于真实增量）
        const dlBytes = Math.max(0, rxDelta);
        const ulBytes = Math.max(0, txDelta);
        this.quota.sessionUsed += dlBytes + ulBytes;
        this.todayStats.download += dlBytes;
        this.todayStats.upload += ulBytes;
        this.monthStats.download += dlBytes;
        this.monthStats.upload += ulBytes;
      }
    } else {
      // 首次采样或获取失败，用模拟数据
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

    // 每分钟记录一个趋势数据点
    if (Date.now() - this._lastSampleTime >= this._sampleInterval) {
      const now = new Date();
      const hour = now.getHours();
      this.trafficHistory.push({
        time: `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        hour,
        download: Math.round(this.speed.download * 10) / 10,
        upload: Math.round(this.speed.upload * 10) / 10,
      });
      // 保留最近 1440 个点（24 小时 × 每分钟）
      if (this.trafficHistory.length > 1440) {
        this.trafficHistory.shift();
      }
      this._lastSampleTime = Date.now();
    }
  }

  getSpeed() {
    return {
      download: Math.round(this.speed.download * 100) / 100,
      upload: Math.round(this.speed.upload * 100) / 100,
      downloadPeak: Math.round(this.speed.downloadPeak * 100) / 100,
      uploadPeak: Math.round(this.speed.uploadPeak * 100) / 100,
    };
  }

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

  getDevices() {
    return this.devices.filter(d => d.active).map(d => ({
      ...d,
      joinDuration: Math.floor((Date.now() - d.joinTime) / 1000),
      maskedMac: d.mac.slice(0, 5) + '**:**:**',
      maskedIp: d.ip && d.ip !== '--' ? d.ip.replace(/(\d+)$/, '**') : d.ip,
    }));
  }

  logoutDevice(id) {
    const d = this.devices.find(d => d.id === id);
    if (d) { d.active = false; return true; }
    return false;
  }

  getStats() {
    // 自动日期滚动
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

  getTrend() { return this.trafficHistory.slice(-60); } // 最近 60 个点
  getThresholds() { return this.thresholds; }
  setThresholds(t) { Object.assign(this.thresholds, t); }
  getLoginStatus() { return this.loginStatus; }
}

module.exports = { TrafficSimulator };
