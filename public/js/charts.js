/**
 * CAUCNet Traffic - Canvas 图表模块
 */
const TrafficCharts = (() => {

  const COLORS = {
    green: '#22c55e',
    greenDim: 'rgba(34, 197, 94, 0.15)',
    blue: '#3b82f6',
    blueDim: 'rgba(59, 130, 246, 0.15)',
    orange: '#f97316',
    red: '#ef4444',
    grid: 'rgba(0,0,0,0.04)',
    gridText: '#94a3b8',
  };

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    let w, h;
    // If canvas has explicit width/height attributes, use those
    const attrW = canvas.getAttribute('width');
    const attrH = canvas.getAttribute('height');
    if (attrW && attrH) {
      w = parseInt(attrW);
      h = parseInt(attrH);
    } else {
      // Use parent container size
      const parent = canvas.parentElement;
      if (parent) {
        w = parent.clientWidth || 300;
        h = parent.clientHeight || 200;
      } else {
        w = 300; h = 200;
      }
    }
    // Only resize if actually different
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /** 速度仪表盘 */
  function drawGauge(canvas, value, max, color) {
    const { ctx, w, h } = setupCanvas(canvas);
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2 - 8;
    const lw = 8;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalAngle = endAngle - startAngle;
    const progress = Math.min(value / max, 1);

    ctx.clearRect(0, 0, w, h);

    // 底圈
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 进度圈
    if (progress > 0.001) {
      const grad = ctx.createLinearGradient(0, h, w, 0);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + 'cc');
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + totalAngle * progress);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 中心数字 — 直接用 value，与下方文字同步
    ctx.fillStyle = color;
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value < 10 ? value.toFixed(1) : Math.round(value), cx, cy - 4);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText('Mbps', cx, cy + 16);
  }

  /** 流量环形图 */
  function drawOverviewRing(canvas, usedPercent) {
    const { ctx, w, h } = setupCanvas(canvas);
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2 - 10;
    const lw = 12;
    const progress = Math.min(usedPercent / 100, 1);

    ctx.clearRect(0, 0, w, h);

    // 底圈
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = lw;
    ctx.stroke();

    // 进度圈
    const color = usedPercent > 80 ? COLORS.red : usedPercent > 60 ? COLORS.orange : COLORS.green;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 中心文字
    ctx.fillStyle = '#1a1a2e';
    ctx.font = `bold 26px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${usedPercent}%`, cx, cy - 4);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText('已使用', cx, cy + 18);
  }

  /** 趋势折线图 */
  function drawTrend(canvas, data) {
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { top: 20, right: 15, bottom: 30, left: 45 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);
    if (!data || data.length === 0) return;

    const maxVal = Math.max(...data.map(d => d.download), 10) * 1.15;

    // 网格线
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      const val = maxVal - (i / 4) * maxVal;
      ctx.fillStyle = COLORS.gridText;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(val), pad.left - 6, y + 3);
    }

    // X 轴标签
    ctx.fillStyle = COLORS.gridText;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const step = Math.ceil(data.length / 8);
    data.forEach((d, i) => {
      if (i % step === 0) {
        const x = pad.left + (i / (data.length - 1)) * cw;
        ctx.fillText(d.time, x, h - 8);
      }
    });

    // 下载面积 + 曲线
    const dlPoints = data.map((d, i) => ({
      x: pad.left + (i / (data.length - 1)) * cw,
      y: pad.top + ch - (d.download / maxVal) * ch,
    }));

    // 面积填充
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dlPoints[0].x, pad.top + ch);
    dlPoints.forEach((p, i) => {
      if (i === 0) { ctx.lineTo(p.x, p.y); return; }
      const prev = dlPoints[i - 1];
      const cpx = (prev.x + p.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
    });
    ctx.lineTo(dlPoints[dlPoints.length - 1].x, pad.top + ch);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, COLORS.greenDim);
    grad.addColorStop(1, 'rgba(34,197,94,0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // 下载曲线
    ctx.save();
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    dlPoints.forEach((p, i) => {
      if (i === 0) { ctx.moveTo(p.x, p.y); return; }
      const prev = dlPoints[i - 1];
      const cpx = (prev.x + p.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();

    // 上传曲线
    const ulPoints = data.map((d, i) => ({
      x: pad.left + (i / (data.length - 1)) * cw,
      y: pad.top + ch - (d.upload / maxVal) * ch,
    }));
    ctx.save();
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ulPoints.forEach((p, i) => {
      if (i === 0) { ctx.moveTo(p.x, p.y); return; }
      const prev = ulPoints[i - 1];
      const cpx = (prev.x + p.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();

    // 数据点
    dlPoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.green;
      ctx.fill();
    });

    // 图例
    ctx.font = '10px "Inter", sans-serif';
    ctx.textAlign = 'left';
    // 下载图例
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(w - pad.right - 100, pad.top - 2, 10, 3);
    ctx.fillStyle = COLORS.gridText;
    ctx.fillText('下载', w - pad.right - 86, pad.top + 2);
    // 上传图例
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(w - pad.right - 100, pad.top + 14);
    ctx.lineTo(w - pad.right - 90, pad.top + 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.gridText;
    ctx.fillText('上传', w - pad.right - 86, pad.top + 18);

    // 存储数据点用于 tooltip
    canvas._trendData = { dlPoints, ulPoints, data, pad, cw, ch, maxVal };
  }

  return { drawGauge, drawOverviewRing, drawTrend };
})();
window.TrafficCharts = TrafficCharts;
