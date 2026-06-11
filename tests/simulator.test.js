const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { TrafficSimulator } = require('../services/simulator');

describe('TrafficSimulator', () => {
  let sim;

  beforeEach(() => {
    sim = new TrafficSimulator();
  });

  describe('constructor', () => {
    it('should initialize with default account info', () => {
      assert.ok(sim.account);
      assert.ok(sim.account.username);
      assert.equal(sim.account.campus, '中国民航大学');
    });

    it('should initialize with unlimited quota', () => {
      assert.equal(sim.quota.total, Infinity);
    });

    it('should initialize with sample devices', () => {
      assert.ok(sim.devices.length >= 1);
      for (const d of sim.devices) {
        assert.ok(d.id);
        assert.ok(d.name);
        assert.ok(d.mac);
        assert.ok(d.type);
        assert.equal(typeof d.active, 'boolean');
      }
    });

    it('should initialize with thresholds', () => {
      assert.deepEqual(sim.thresholds, {
        trafficWarn: 80,
        balanceWarn: 10,
        speedMin: 0.5,
      });
    });

    it('should initialize with login status', () => {
      assert.ok(sim.loginStatus);
      assert.equal(sim.loginStatus.loggedIn, true);
      assert.ok(sim.loginStatus.ip);
    });

    it('should initialize traffic history with 24 points', () => {
      assert.equal(sim.trafficHistory.length, 24);
      for (const point of sim.trafficHistory) {
        assert.ok(point.time);
        assert.equal(typeof point.hour, 'number');
        assert.equal(typeof point.download, 'number');
        assert.equal(typeof point.upload, 'number');
      }
    });
  });

  describe('getSpeed()', () => {
    it('should return speed object with correct fields', () => {
      const speed = sim.getSpeed();
      assert.equal(typeof speed.download, 'number');
      assert.equal(typeof speed.upload, 'number');
      assert.equal(typeof speed.downloadPeak, 'number');
      assert.equal(typeof speed.uploadPeak, 'number');
    });

    it('should return non-negative values', () => {
      const speed = sim.getSpeed();
      assert.ok(speed.download >= 0);
      assert.ok(speed.upload >= 0);
      assert.ok(speed.downloadPeak >= 0);
      assert.ok(speed.uploadPeak >= 0);
    });
  });

  describe('getOverview()', () => {
    it('should return overview with all required fields', () => {
      const ov = sim.getOverview();
      assert.ok(ov.account);
      assert.equal(typeof ov.isUnlimited, 'boolean');
      assert.equal(typeof ov.usedPercent, 'number');
      assert.equal(typeof ov.balance, 'number');
      assert.equal(typeof ov.sessionUsedMB, 'number');
      assert.equal(typeof ov.sessionDuration, 'number');
    });

    it('should report unlimited for unlimited plan', () => {
      const ov = sim.getOverview();
      assert.equal(ov.isUnlimited, true);
      assert.equal(ov.usedPercent, 0);
    });

    it('should have non-negative session duration', () => {
      const ov = sim.getOverview();
      assert.ok(ov.sessionDuration >= 0);
    });
  });

  describe('getDevices()', () => {
    it('should return only active devices', () => {
      const devices = sim.getDevices();
      for (const d of devices) {
        assert.equal(d.active, true);
      }
    });

    it('should include masked MAC and IP', () => {
      const devices = sim.getDevices();
      for (const d of devices) {
        assert.ok(d.maskedMac);
        assert.ok(d.maskedIp);
        assert.equal(typeof d.joinDuration, 'number');
      }
    });
  });

  describe('logoutDevice()', () => {
    it('should deactivate an existing device', () => {
      const firstDevice = sim.devices[0];
      assert.equal(firstDevice.active, true);
      const result = sim.logoutDevice(firstDevice.id);
      assert.equal(result, true);
      assert.equal(firstDevice.active, false);
    });

    it('should return false for non-existent device', () => {
      const result = sim.logoutDevice('non-existent-id');
      assert.equal(result, false);
    });

    it('should remove device from getDevices() after logout', () => {
      const firstDevice = sim.devices[0];
      const before = sim.getDevices().length;
      sim.logoutDevice(firstDevice.id);
      const after = sim.getDevices().length;
      assert.equal(after, before - 1);
    });
  });

  describe('getStats()', () => {
    it('should return today and month stats', () => {
      const stats = sim.getStats();
      assert.ok(stats.today);
      assert.ok(stats.month);
    });

    it('should have correct today stats structure', () => {
      const stats = sim.getStats();
      assert.ok(stats.today.date);
      assert.equal(typeof stats.today.downloadGB, 'number');
      assert.equal(typeof stats.today.uploadGB, 'number');
      assert.equal(typeof stats.today.totalGB, 'number');
      assert.equal(typeof stats.today.peakMbps, 'number');
    });

    it('should have correct month stats structure', () => {
      const stats = sim.getStats();
      assert.ok(stats.month.month);
      assert.equal(typeof stats.month.downloadGB, 'number');
      assert.equal(typeof stats.month.uploadGB, 'number');
      assert.equal(typeof stats.month.totalGB, 'number');
      assert.equal(typeof stats.month.avgDailyGB, 'number');
    });

    it('should have non-negative values', () => {
      const stats = sim.getStats();
      assert.ok(stats.today.downloadGB >= 0);
      assert.ok(stats.today.uploadGB >= 0);
      assert.ok(stats.month.downloadGB >= 0);
    });
  });

  describe('getTrend()', () => {
    it('should return up to 60 data points', () => {
      const trend = sim.getTrend();
      assert.ok(trend.length <= 60);
      assert.ok(trend.length > 0);
    });

    it('should have time, download, upload in each point', () => {
      const trend = sim.getTrend();
      for (const point of trend) {
        assert.ok(point.time);
        assert.equal(typeof point.download, 'number');
        assert.equal(typeof point.upload, 'number');
      }
    });
  });

  describe('thresholds', () => {
    it('should get thresholds', () => {
      const t = sim.getThresholds();
      assert.equal(typeof t.trafficWarn, 'number');
      assert.equal(typeof t.balanceWarn, 'number');
    });

    it('should set thresholds via setThresholds()', () => {
      sim.setThresholds({ trafficWarn: 90 });
      assert.equal(sim.thresholds.trafficWarn, 90);
      assert.equal(sim.thresholds.balanceWarn, 10);
    });
  });

  describe('getLoginStatus()', () => {
    it('should return login status with required fields', () => {
      const status = sim.getLoginStatus();
      assert.equal(typeof status.loggedIn, 'boolean');
      assert.ok(status.loginTime);
      assert.ok(status.ip);
      assert.ok(status.nasIp);
      assert.ok(status.accessType);
    });
  });

  describe('tick()', () => {
    it('should update speed after tick', () => {
      sim.tick();
      const speed = sim.getSpeed();
      assert.equal(typeof speed.download, 'number');
      assert.equal(typeof speed.upload, 'number');
    });

    it('should accumulate session usage', () => {
      const beforeMB = sim.getOverview().sessionUsedMB;
      sim.tick();
      const afterMB = sim.getOverview().sessionUsedMB;
      assert.ok(afterMB >= beforeMB);
    });
  });
});
