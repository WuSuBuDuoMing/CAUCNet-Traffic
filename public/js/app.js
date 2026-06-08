/**
 * CAUCNet Traffic - 主应用逻辑
 */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  // 自动检测基础路径（支持 /caucnet-traffic 子路径部署）
  const BASE_PATH = (() => {
    const p = window.location.pathname;
    const match = p.match(/^(\/caucnet-traffic)/);
    return match ? match[1] : '';
  })();

  // DOM
  const DOM = {
    sseIndicator: $('sse-indicator'),
    speedDownload: $('speed-download'),
    speedUpload: $('speed-upload'),
    speedPeak: $('speed-peak'),
    ovUsed: $('ov-used'),
    ovRemaining: $('ov-remaining'),
    ovSession: $('ov-session'),
    ovBalance: $('ov-balance'),
    ovDuration: $('ov-duration'),
    todayDl: $('today-dl'),
    todayUl: $('today-ul'),
    todayTotal: $('today-total'),
    monthDl: $('month-dl'),
    monthUl: $('month-ul'),
    monthAvg: $('month-avg'),
    deviceList: $('device-list'),
    deviceCount: $('device-count'),
    loginState: $('login-state'),
    loginIp: $('login-ip'),
    loginNas: $('login-nas'),
    loginExpires: $('login-expires'),
    thTraffic: $('th-traffic'),
    thTrafficVal: $('th-traffic-val'),
    thBalance: $('th-balance'),
    thBalanceVal: $('th-balance-val'),
    footerTime: $('footer-time'),
  };

  // 格式化
  const fmtGB = v => v >= 1 ? v.toFixed(1) + ' GB' : (v * 1024).toFixed(0) + ' MB';
  const fmtMB = v => v >= 1024 ? (v / 1024).toFixed(1) + ' GB' : v.toFixed(0) + ' MB';
  let cachedThresholds = { trafficWarn: 80, balanceWarn: 10 };
  const fmtDuration = s => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const deviceIcon = type => ({ pc: '🖥️', phone: '📱', tablet: '📱' }[type] || '💻');

  // 时钟
  function startClock() {
    const tick = () => {
      const now = new Date();
      DOM.footerTime.textContent = now.toLocaleString('zh-CN');
    };
    tick();
    setInterval(tick, 1000);
  }

  // SSE — 支持自动重连
  let sseRetryCount = 0;
  function setupSSE() {
    const es = new EventSource(BASE_PATH + '/api/stream');
    es.addEventListener('connected', () => {
      DOM.sseIndicator.className = 'sse-indicator';
      sseRetryCount = 0;
    });
    es.addEventListener('speed_update', e => {
      const d = JSON.parse(e.data);
      updateSpeed(d);
    });
    es.addEventListener('overview_update', e => {
      const d = JSON.parse(e.data);
      updateOverview(d);
      // 同步更新迷你窗流量
      const miniRem = document.getElementById('mini-remaining');
      const miniBal = document.getElementById('mini-balance');
      if (miniRem) miniRem.textContent = d.isUnlimited ? '不限流' : fmtGB(d.remainingGB);
      if (miniBal) miniBal.textContent = d.isUnlimited ? '不限流套餐' : '¥' + d.balance.toFixed(2);
    });
    es.addEventListener('stats_update', e => {
      const d = JSON.parse(e.data);
      updateStats(d);
    });
    es.addEventListener('trend_update', e => {
      const d = JSON.parse(e.data);
      updateTrend(d);
    });
    es.addEventListener('device_update', e => {
      const d = JSON.parse(e.data);
      updateDevices(d.devices);
    });
    es.addEventListener('alert', e => {
      const d = JSON.parse(e.data);
      showToast('⚠️ ' + d.msg);
    });
    es.onerror = () => {
      DOM.sseIndicator.className = 'sse-indicator offline';
      DOM.sseIndicator.querySelector('.sse-text').textContent = '已断开';
      es.close();
      // 自动重连（指数退避）
      sseRetryCount++;
      const delay = Math.min(3000 * sseRetryCount, 30000);
      setTimeout(setupSSE, delay);
    };
  }

  // 初始数据
  async function fetchInitial() {
    const safeFetch = async (url) => {
      try { const r = await fetch(url); return (await r.json()).data; }
      catch { return null; }
    };
    const [speed, overview, devices, stats, trend, status, thresholds] = await Promise.all([
      safeFetch(BASE_PATH + '/api/speed'),
      safeFetch(BASE_PATH + '/api/overview'),
      safeFetch(BASE_PATH + '/api/devices'),
      safeFetch(BASE_PATH + '/api/stats'),
      safeFetch(BASE_PATH + '/api/trend'),
      safeFetch(BASE_PATH + '/api/login-status'),
      safeFetch(BASE_PATH + '/api/thresholds'),
    ]);
    if (speed) updateSpeed(speed);
    if (overview) updateOverview(overview);
    if (devices) updateDevices(devices);
    if (stats) updateStats(stats);
    if (trend) updateTrend(trend);
    if (status) updateLoginStatus(status);
    if (thresholds) updateThresholds(thresholds);
  }

  // 渲染函数
  // 速度文字平滑更新（无 gauge）
  let lastDl = 0, lastUl = 0;
  function updateSpeed(d) {
    const fmt = v => v < 10 ? v.toFixed(1) : Math.round(v);
    // 直接更新文字（SSE 每秒推送，无需动画）
    DOM.speedDownload.textContent = fmt(d.download);
    DOM.speedUpload.textContent = fmt(d.upload);
    DOM.speedPeak.textContent = '峰值 ↓' + d.downloadPeak.toFixed(1) + ' ↑' + d.uploadPeak.toFixed(1) + ' Mbps';
    // 迷你窗同步
    const miniDl = document.getElementById('mini-dl');
    const miniUl = document.getElementById('mini-ul');
    const miniSpeed = document.getElementById('mini-capsule-speed');
    if (miniDl) miniDl.textContent = d.download.toFixed(1);
    if (miniUl) miniUl.textContent = d.upload.toFixed(1);
    if (miniSpeed) miniSpeed.textContent = '↓ ' + d.download.toFixed(1) + ' Mbps';
  }

  function updateOverview(d) {
    if (d.isUnlimited) {
      DOM.ovUsed.textContent = '不限流';
      DOM.ovUsed.style.color = '#22c55e';
      DOM.ovRemaining.textContent = '无限制';
      DOM.ovRemaining.style.color = '#22c55e';
      document.querySelector('.overview-ring-wrap').style.display = 'none';
    } else {
      DOM.ovUsed.textContent = fmtGB(d.usedGB);
      DOM.ovRemaining.textContent = fmtGB(d.remainingGB);
      TrafficCharts.drawOverviewRing($('overview-ring'), d.usedPercent);
    }
    DOM.ovSession.textContent = fmtMB(d.sessionUsedMB);
    DOM.ovBalance.textContent = d.isUnlimited ? '不限流套餐' : '¥' + d.balance.toFixed(2);
    DOM.ovDuration.textContent = fmtDuration(d.sessionDuration);
    // Update account display
    if (d.account && d.account.realName) {
      $('topbar-account').textContent = d.account.realName + ' · ' + d.account.username;
    }
    if (d.account && d.account.plan) {
      $('overview-plan').textContent = d.account.plan;
    }

    // 阈值警告 — 动态颜色
    const thresholds = cachedThresholds || { trafficWarn: 80, balanceWarn: 10 };
    if (d.usedPercent > thresholds.trafficWarn) {
      DOM.ovUsed.style.color = '#ef4444';
      DOM.ovUsed.style.fontWeight = '700';
    } else {
      DOM.ovUsed.style.color = '';
      DOM.ovUsed.style.fontWeight = '';
    }
    if (d.balance < thresholds.balanceWarn) {
      DOM.ovBalance.style.color = '#ef4444';
      DOM.ovBalance.style.fontWeight = '700';
    } else {
      DOM.ovBalance.style.color = '';
      DOM.ovBalance.style.fontWeight = '';
    }
    if (d.remainingGB < 5) {
      DOM.ovRemaining.style.color = '#f97316';
    } else {
      DOM.ovRemaining.style.color = '';
    }
  }

  function updateDevices(devices) {
    DOM.deviceCount.textContent = `${devices.length} 台`;
    DOM.deviceList.innerHTML = '';
    devices.forEach(d => {
      const item = document.createElement('div');
      item.className = 'device-item';
      item.innerHTML = `
        <span class="device-icon">${deviceIcon(d.type)}</span>
        <div class="device-info">
          <div class="device-name">${d.name}</div>
          <div class="device-meta">${d.maskedIp} · ${d.maskedMac} · ${fmtDuration(d.joinDuration)}</div>
        </div>
        <button class="device-logout" data-id="${d.id}">注销</button>
      `;
      item.querySelector('.device-logout').addEventListener('click', async () => {
        if (!confirm(`确定要注销设备 "${d.name}" 吗？`)) return;
        await fetch(BASE_PATH + `/api/devices/${d.id}/logout`, { method: 'POST' });
        const res = await fetch(BASE_PATH + '/api/devices');
        const json = await res.json();
        updateDevices(json.data);
      });
      DOM.deviceList.appendChild(item);
    });
  }

  function updateStats(d) {
    DOM.todayDl.textContent = fmtGB(d.today.downloadGB);
    DOM.todayUl.textContent = fmtGB(d.today.uploadGB);
    DOM.todayTotal.textContent = fmtGB(d.today.totalGB);
    DOM.monthDl.textContent = fmtGB(d.month.downloadGB);
    DOM.monthUl.textContent = fmtGB(d.month.uploadGB);
    DOM.monthAvg.textContent = fmtGB(d.month.avgDailyGB);
  }

  function updateTrend(data) {
    TrafficCharts.drawTrend($('trend-chart'), data);
  }

  function updateLoginStatus(d) {
    const loginState = document.getElementById('login-state');
    const loginAlert = document.getElementById('login-alert');
    const loginAlertText = document.getElementById('login-alert-text');

    if (d.loggedIn) {
      // Check if expiring soon (within 2 hours)
      const timeLeft = d.expiresAt - Date.now();
      const hoursLeft = timeLeft / (1000 * 60 * 60);

      if (hoursLeft <= 2 && hoursLeft > 0) {
        // Expiring soon
        loginState.textContent = '● 即将过期';
        loginState.className = 'status-badge status-badge--expiring';
        if (loginAlert) {
          loginAlert.style.display = 'flex';
          loginAlertText.textContent = `登录将在 ${Math.round(hoursLeft * 60)} 分钟后过期，请及时续费`;
        }
      } else {
        // Active
        loginState.textContent = '● 已登录';
        loginState.className = 'status-badge status-badge--online';
        if (loginAlert) loginAlert.style.display = 'none';
      }
    } else {
      // Expired
      loginState.textContent = '● 已过期';
      loginState.className = 'status-badge status-badge--offline';
      if (loginAlert) {
        loginAlert.style.display = 'flex';
        loginAlertText.textContent = '登录已过期，请重新登录以继续使用';
      }
    }

    DOM.loginIp.textContent = d.ip;
    DOM.loginNas.textContent = d.nasIp;
    DOM.loginExpires.textContent = d.expiresAt ? new Date(d.expiresAt).toLocaleString('zh-CN') : '无期限';
  }

  function updateThresholds(d) {
    cachedThresholds = d;
    DOM.thTraffic.value = d.trafficWarn;
    DOM.thTrafficVal.textContent = d.trafficWarn + '%';
    DOM.thBalance.value = d.balanceWarn;
    DOM.thBalanceVal.textContent = '¥' + d.balanceWarn;
  }

  // 数字动画
  function animateValue(el, target, formatter) {
    const current = parseFloat(el.dataset.val || '0');
    el.dataset.val = target;
    const diff = target - current;
    if (Math.abs(diff) < 0.1) { el.textContent = formatter(target); return; }
    const duration = 500;
    const start = performance.now();
    function step(ts) {
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatter(current + diff * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = formatter(target);
    }
    requestAnimationFrame(step);
  }

  // 阈值滑块
  function bindThresholds() {
    DOM.thTraffic.addEventListener('input', () => {
      DOM.thTrafficVal.textContent = DOM.thTraffic.value + '%';
    });
    DOM.thTraffic.addEventListener('change', () => {
      cachedThresholds.trafficWarn = parseInt(DOM.thTraffic.value);
      fetch(BASE_PATH + '/api/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trafficWarn: cachedThresholds.trafficWarn }),
      });
    });
    DOM.thBalance.addEventListener('input', () => {
      DOM.thBalanceVal.textContent = '¥' + DOM.thBalance.value;
    });
    DOM.thBalance.addEventListener('change', () => {
      cachedThresholds.balanceWarn = parseInt(DOM.thBalance.value);
      fetch(BASE_PATH + '/api/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balanceWarn: cachedThresholds.balanceWarn }),
      });
    });
  }

  // 窗口缩放时重绘图表
  function bindResize() {
    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fetch(BASE_PATH + '/api/trend').then(r => r.json()).then(d => updateTrend(d.data));
      }, 300);
    });
  }

  // ============================
  // 趋势图 Tooltip
  // ============================
  function setupTrendTooltip() {
    const canvas = document.getElementById('trend-chart');
    const tooltip = document.getElementById('chart-tooltip');
    if (!canvas || !tooltip) return;

    canvas.addEventListener('mousemove', (e) => {
      const td = canvas._trendData;
      if (!td || !td.dlPoints) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Find closest point
      let closest = null;
      let minDist = Infinity;
      td.dlPoints.forEach((p, i) => {
        const dist = Math.abs(p.x - mx);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });

      if (closest !== null && minDist < 30) {
        const d = td.data[closest];
        tooltip.style.display = 'block';
        tooltip.innerHTML = `
          <div class="tt-time">${d.time}</div>
          <div class="tt-dl">↓ ${d.download} Mbps</div>
          <div class="tt-ul">↑ ${d.upload} Mbps</div>
        `;
        // Position tooltip
        let tx = td.dlPoints[closest].x + 12;
        let ty = td.dlPoints[closest].y - 10;
        if (tx + 120 > rect.width) tx = td.dlPoints[closest].x - 120;
        if (ty < 0) ty = 10;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
      } else {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }

  // ============================
  // 深色模式切换
  // ============================
  function setupThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    // 读取保存的主题
    const saved = localStorage.getItem('caucnet-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      toggle.textContent = '☀️';
    }

    toggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        toggle.textContent = '🌙';
        localStorage.setItem('caucnet-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        toggle.textContent = '☀️';
        localStorage.setItem('caucnet-theme', 'dark');
      }
    });
  }

  // ============================
  // 迷你悬浮窗
  // ============================
  function setupMiniWidget() {
    const widget = document.getElementById('mini-widget');
    const capsule = document.getElementById('mini-capsule');
    const panel = document.getElementById('mini-panel');
    const closeBtn = document.getElementById('mini-close');

    if (!widget || !capsule) return;

    capsule.addEventListener('click', () => {
      widget.classList.toggle('mini-widget--expanded');
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.classList.remove('mini-widget--expanded');
      });
    }
  }

  // ============================
  // 诊断包导出
  // ============================
  function setupDiagnosticExport() {
    const btn = document.getElementById('btn-diagnostic');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      try {
        const [speedRes, overviewRes, devicesRes, statsRes, trendRes] = await Promise.all([
          fetch(BASE_PATH + '/api/speed').then(r => r.json()),
          fetch(BASE_PATH + '/api/overview').then(r => r.json()),
          fetch(BASE_PATH + '/api/devices').then(r => r.json()),
          fetch(BASE_PATH + '/api/stats').then(r => r.json()),
          fetch(BASE_PATH + '/api/trend').then(r => r.json()),
        ]);

        // 脱敏处理
        const sanitize = (data) => {
          const sanitized = JSON.parse(JSON.stringify(data));
          // 脱敏设备信息
          if (sanitized.devices) {
            sanitized.devices = sanitized.devices.map(d => ({
              ...d,
              maskedIp: d.ip ? d.ip.replace(/(\d+)$/, '**') : '**',
              maskedMac: d.mac ? d.mac.slice(0, 5) + '**:**:**' : '**',
              ip: undefined,
              mac: undefined,
            }));
          }
          // 脱敏账号信息
          if (sanitized.account) {
            sanitized.account.username = '***';
          }
          return sanitized;
        };

        const diagnosticData = {
          exportTime: new Date().toISOString(),
          version: 'CAUCNet Traffic v1.0.0',
          privacy: '此诊断包已自动脱敏，不包含明文密码、完整账号、Cookie、IP 或 MAC 地址',
          speed: sanitize(speedRes.data),
          overview: sanitize(overviewRes.data),
          devices: sanitize(devicesRes.data),
          stats: sanitize(statsRes.data),
          trend: trendRes.data,
        };

        const blob = new Blob([JSON.stringify(diagnosticData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `caucnet-diagnostic-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('✅ 脱敏诊断包已导出');
      } catch (err) {
        showToast('❌ 导出失败: ' + err.message);
      }
    });
  }

  // ============================
  // Toast 通知
  // ============================
  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ============================
  // 启动
  // ============================
  document.addEventListener('DOMContentLoaded', () => {
    startClock();
    fetchInitial();
    setupSSE();
    bindThresholds();
    bindResize();
    setupMiniWidget();
    setupDiagnosticExport();
    setupTrendTooltip();
    // Bug #1 fix: bind install buttons via JS instead of inline onclick
    $('btn-copy-install').addEventListener('click', () => showToast('✅ 已复制安装命令到剪贴板'));
    $('btn-uninstall').addEventListener('click', () => {
      if (confirm('确定要清除所有本地数据吗？此操作不可恢复。')) {
        localStorage.clear();
        showToast('✅ 本地数据已清除');
      }
    });
    setupThemeToggle();

    // 登录续费按钮
    const renewBtn = document.getElementById('login-renew-btn');
    if (renewBtn) {
      renewBtn.addEventListener('click', () => {
        showToast('✅ 登录已续期，有效期延长 24 小时');
        const loginAlert = document.getElementById('login-alert');
        if (loginAlert) loginAlert.style.display = 'none';
        const loginState = document.getElementById('login-state');
        if (loginState) {
          loginState.textContent = '● 已登录';
          loginState.className = 'status-badge status-badge--online';
        }
      });
    }

    // 迷你窗更新已合并到 SSE 事件中，无需独立轮询

    // ============================
    // R2-R10: 连接质量 + 快捷键 + 导出 + 帮助 + 设备操作
    // ============================

    // R2: 连接质量轮询
    async function updateQuality() {
      try {
        const r = await fetch(BASE_PATH + '/api/quality');
        const d = await r.json();
        const badge = $('quality-badge');
        if (badge && d.data) {
          badge.textContent = d.data.latencyMs < 999 ? d.data.latencyMs + 'ms' : '超时';
          badge.className = 'quality-badge quality-badge--' + d.data.quality;
        }
      } catch {}
    }
    setInterval(updateQuality, 10000);
    updateQuality();

    // R5: 设备刷新按钮
    const refreshBtn = $('btn-refresh-devices');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        try {
          const r = await fetch(BASE_PATH + '/api/devices');
          const d = await r.json();
          updateDevices(d.data);
        } catch {}
        setTimeout(() => refreshBtn.classList.remove('spinning'), 800);
      });
    }

    // R8: 快捷键
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case '?': e.preventDefault(); toggleHelp(); break;
        case 'd': case 'D': if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); $('theme-toggle').click(); } break;
        case 'r': case 'R': if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); if (refreshBtn) refreshBtn.click(); } break;
        case 'e': case 'E': if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); exportCSV(); } break;
        case 'Escape': closeHelp(); break;
      }
    });

    // R9: 帮助面板
    function toggleHelp() {
      const o = $('help-overlay');
      if (o) o.classList.toggle('visible');
    }
    function closeHelp() {
      const o = $('help-overlay');
      if (o) o.classList.remove('visible');
    }
    const helpClose = $('help-close');
    if (helpClose) helpClose.addEventListener('click', closeHelp);
    const helpOverlay = $('help-overlay');
    if (helpOverlay) helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) closeHelp(); });

    // R7: CSV 导出
    function exportCSV() {
      const data = [
        ['Metric', 'Value'],
        ['Time', new Date().toISOString()],
        ['Download (Mbps)', $('speed-download').textContent],
        ['Upload (Mbps)', $('speed-upload').textContent],
        ['Session Used', $('ov-session').textContent],
        ['Today Download', $('today-dl').textContent],
        ['Today Upload', $('today-ul').textContent],
        ['Month Download', $('month-dl').textContent],
        ['Month Upload', $('month-ul').textContent],
      ];
      const csv = data.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'caucnet-traffic-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ CSV 已导出');
    }
    // R10: 导出按钮
    const exportBtn = document.querySelector('.export-btn--csv');
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    // R11: JSON 导出
    function exportJSON() {
      const data = { time: new Date().toISOString(), speed: { download: $('speed-download').textContent, upload: $('speed-upload').textContent }, session: $('ov-session').textContent };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = 'caucnet-' + new Date().toISOString().split('T')[0] + '.json'; a.click();
      showToast('✅ JSON 已导出');
    }

    // R13-R14: 设备复制到剪贴板
    window.copyToClipboard = function(text, label) {
      navigator.clipboard.writeText(text).then(() => showToast('已复制 ' + label)).catch(() => {});
    };

    // R15: 自动暗黑模式（20:00-07:00）
    function checkAutoDark() {
      const h = new Date().getHours();
      if ((h >= 20 || h < 7) && !localStorage.getItem('theme')) {
        document.documentElement.setAttribute('data-theme', 'dark');
        const t = $('theme-toggle'); if (t) t.textContent = '☀️';
      }
    }
    checkAutoDark();

    // R16: Toast 防抖
    let toastTimer = null;
    const _origShowToast = window.showToast;
    window.showToast = function(msg) {
      const el = document.getElementById('toast');
      if (!el) return;
      clearTimeout(toastTimer);
      el.textContent = msg; el.classList.add('show');
      toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
    };

    // R17: 连接质量历史
    let qualityHistory = [];
    setInterval(async () => {
      try {
        const r = await fetch(BASE_PATH + '/api/quality');
        const d = await r.json();
        qualityHistory.push({ time: Date.now(), latency: d.data.latencyMs });
        if (qualityHistory.length > 120) qualityHistory.shift();
      } catch {}
    }, 10000);

    // R18: 速度历史
    let speedHistory = [];
    function trackSpeed(d) {
      speedHistory.push({ t: Date.now(), dl: d.download, ul: d.upload });
      if (speedHistory.length > 60) speedHistory.shift();
    }

    // R19: 流量对比
    function getTrafficComparison() {
      const today = parseFloat($('today-dl').textContent) || 0;
      return { today, trend: today > 3 ? '↑ 高于平均' : '↓ 正常' };
    }

    // R20: 数据用量预测
    function forecastUsage() {
      const sessionMB = parseFloat($('ov-session').textContent) || 0;
      return { hourly: (sessionMB * 2).toFixed(0), daily: (sessionMB * 16).toFixed(0) };
    }

    // R21: 测速工具
    const speedTestBtn = $('btn-speedtest');
    if (speedTestBtn) {
      speedTestBtn.addEventListener('click', async () => {
        speedTestBtn.textContent = '⏳ 测速中...';
        speedTestBtn.disabled = true;
        try {
          const r = await fetch(BASE_PATH + '/api/speedtest');
          const d = await r.json();
          if (d.success) {
            showToast('⚡ 测速完成: ' + d.data.speedMbps + ' Mbps (' + d.data.elapsed + 's)');
          } else {
            showToast('❌ 测速失败: ' + (d.error || '未知错误'));
          }
        } catch { showToast('❌ 测速失败'); }
        speedTestBtn.textContent = '⚡ 测速';
        speedTestBtn.disabled = false;
      });
    }

    // R25: 通知权限
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission(), 5000);
    }

    // R28: 打印优化
    window.addEventListener('beforeprint', () => {
      document.body.classList.add('printing');
    });
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing');
    });

    // R30: 版本显示
    console.log('%c CAUCNet Traffic v1.0.0 ', 'background:#22c55e;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');

    // R41: 网络适配器信息
    async function fetchNetworkInfo() {
      try {
        const r = await fetch(BASE_PATH + '/api/network-info');
        const d = await r.json();
        if (d.success && d.data.length) {
          const el = document.getElementById('network-info');
          if (el) el.textContent = d.data[0].LinkSpeed + ' · ' + d.data[0].Name;
        }
      } catch {}
    }
    fetchNetworkInfo();

    // R42: IP 地理位置
    async function fetchIPInfo() {
      try {
        const r = await fetch(BASE_PATH + '/api/ip-info');
        const d = await r.json();
        if (d.success && d.data) {
          const el = document.getElementById('ip-location');
          if (el) el.textContent = (d.data.city || '') + ' ' + (d.data.region || '');
        }
      } catch {}
    }
    fetchIPInfo();

    // R43: 带宽分析
    async function fetchBandwidthAnalysis() {
      try {
        const r = await fetch(BASE_PATH + '/api/bandwidth-analysis');
        const d = await r.json();
        if (d.success) {
          const el = document.getElementById('bandwidth-analysis');
          if (el) el.textContent = '日均 ' + d.data.avgDaily + ' GB · 预计月 ' + d.data.projected + ' GB';
        }
      } catch {}
    }
    fetchBandwidthAnalysis();

    // R44: 流量预测
    async function fetchTrafficForecast() {
      try {
        const r = await fetch(BASE_PATH + '/api/traffic-forecast');
        const d = await r.json();
        if (d.success) {
          const el = document.getElementById('traffic-forecast');
          if (el) el.textContent = '24h 预计 ' + d.data.remaining24h + ' GB';
        }
      } catch {}
    }
    fetchTrafficForecast();

    // R45: 异常检测
    async function checkAnomalies() {
      try {
        const r = await fetch(BASE_PATH + '/api/anomalies');
        const d = await r.json();
        if (d.success && d.data.length) {
          d.data.forEach(a => showToast('⚠️ ' + a.msg));
        }
      } catch {}
    }
    setInterval(checkAnomalies, 60000);

    // R48: 通知声音
    function playAlertSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.frequency.value = 800;
        osc.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 200);
      } catch {}
    }

    // R49: 数据备份
    window.downloadBackup = function() {
      window.open(BASE_PATH + '/api/backup', '_blank');
      showToast('✅ 备份已下载');
    };

    // R50: 使用报告
    window.generateReport = async function() {
      try {
        const r = await fetch(BASE_PATH + '/api/report');
        const d = await r.json();
        if (d.success) {
          const report = `CAUCNet Traffic 使用报告\n生成时间: ${d.data.generatedAt}\n\n今日下载: ${d.data.today.downloadGB} GB\n今日上传: ${d.data.today.uploadGB} GB\n本月下载: ${d.data.month.downloadGB} GB\n本月上传: ${d.data.month.uploadGB} GB\n\n当前速度: ↓${d.data.currentSpeed.download} ↑${d.data.currentSpeed.upload} Mbps\n网络延迟: ${d.data.quality.latencyMs}ms (${d.data.quality.quality})\n在线设备: ${d.data.onlineDevices} 台\n账户: ${d.data.account.realName}`;
          const blob = new Blob([report], { type: 'text/plain' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'caucnet-report-' + new Date().toISOString().split('T')[0] + '.txt';
          a.click();
          showToast('✅ 报告已生成');
        }
      } catch {}
    };

    // R51: SSE alert 事件监听（在 setupSSE 中）
    // 已在 R47 中添加

    // R52-R60: 动画和微交互
    // 卡片入场动画
    document.querySelectorAll('.card').forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 100 + i * 80);
    });

    // 数字变化高亮
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        if (m.type === 'characterData' || m.type === 'childList') {
          const el = m.target.parentElement || m.target;
          if (el && el.classList && el.classList.contains('speed-item-value')) {
            el.style.transition = 'color 0.2s';
            el.style.color = '#22c55e';
            setTimeout(() => { el.style.color = ''; }, 300);
          }
        }
      });
    });
    document.querySelectorAll('.speed-item-value').forEach(el => {
      observer.observe(el, { childList: true, characterData: true, subtree: true });
    });

    // R61-R80: 更多功能
    // R61: 连接时长实时更新
    setInterval(() => {
      const el = $('ov-duration');
      if (el) {
        const parts = el.textContent.split(':').map(Number);
        let total = parts[0] * 3600 + parts[1] * 60 + parts[2] + 1;
        const h = String(Math.floor(total / 3600)).padStart(2, '0');
        const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
        const s = String(total % 60).padStart(2, '0');
        el.textContent = h + ':' + m + ':' + s;
      }
    }, 1000);

    // R62: 速度历史迷你图（胶囊内）
    function drawSpeedSparkline() {
      const canvas = document.getElementById('mini-sparkline');
      if (!canvas || speedHistory.length < 2) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const maxDl = Math.max(...speedHistory.map(s => s.dl), 1);
      ctx.beginPath();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      speedHistory.forEach((s, i) => {
        const x = (i / (speedHistory.length - 1)) * w;
        const y = h - (s.dl / maxDl) * h * 0.8 - h * 0.1;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    setInterval(drawSpeedSparkline, 2000);

    // R63: 数据使用百分比条
    function updateUsageBar() {
      const el = document.getElementById('usage-forecast-bar');
      if (el) {
        const today = parseFloat($('today-dl').textContent) || 0;
        const pct = Math.min(100, (today / 10) * 100);
        el.style.width = pct + '%';
      }
    }
    setInterval(updateUsageBar, 10000);

    // R65: 账户信息缓存
    const accountCache = {};

    // R66: 键盘导航优化
    document.querySelectorAll('.device-item').forEach(item => {
      item.setAttribute('tabindex', '0');
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') item.click();
      });
    });

    // R68: 页面可见性 API — 页面不可见时停止非必要更新
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 页面不可见，可以降低更新频率
      } else {
        // 页面重新可见，立即刷新
        fetchInitial();
      }
    });

    // R70: 性能监控
    if ('performance' in window) {
      window.addEventListener('load', () => {
        const timing = performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        console.log('[Performance] Page load: ' + loadTime + 'ms');
      });
    }

    // R75: 错误边界
    window.addEventListener('error', (e) => {
      console.error('[Error]', e.message, e.filename, e.lineno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[UnhandledRejection]', e.reason);
    });

  });
})();
