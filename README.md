# CAUCNet Traffic — 校园网流量助手

🌐 中国民航大学校园网流量实时监控工具

## 功能特性

- ⚡ **实时网速** — 系统网卡真实速度，每秒更新
- 📊 **流量概览** — 会话/今日/本月流量统计
- 📈 **流量趋势** — 24小时真实流量曲线
- 💻 **在线设备** — 实时设备列表，一键注销
- 🔐 **登录状态** — IP/NAS/到期时间
- 📡 **连接质量** — 实时 ping 延迟 + 质量评级
- ⚡ **测速工具** — Cloudflare 测速节点
- 🌙 **暗黑模式** — 手动/自动切换（夜间自动）
- ⌨️ **快捷键** — `?` 帮助 / `D` 暗黑 / `R` 刷新 / `E` 导出
- 📋 **数据导出** — CSV/JSON/TXT 格式
- 🔔 **阈值告警** — 流量/余额超限自动提醒
- 💾 **数据备份** — 一键导出配置
- 📱 **响应式** — 桌面/平板/手机全适配
- ♿ **无障碍** — prefers-reduced-motion + 键盘焦点

## 快速开始

```bash
cd 04-CAUCNet-Traffic
npm install
npm start
# 访问 http://localhost:3004
```

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 HTML/CSS/JS（零依赖）
- **图表**: Canvas 2D API
- **实时**: Server-Sent Events (SSE)
- **数据**: Windows Get-NetAdapterStatistics + 校园网 API

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/speed` | GET | 实时速度 |
| `/api/overview` | GET | 流量概览 |
| `/api/devices` | GET | 在线设备 |
| `/api/stats` | GET | 流量统计 |
| `/api/trend` | GET | 流量趋势 |
| `/api/quality` | GET | 连接质量 |
| `/api/speedtest` | GET | 测速 |
| `/api/health` | GET | 健康检查 |
| `/api/stream` | GET | SSE 实时推送 |

## 快捷键

| 按键 | 功能 |
|------|------|
| `?` | 打开帮助 |
| `D` | 切换暗黑模式 |
| `R` | 刷新设备 |
| `E` | 导出 CSV |
| `Esc` | 关闭面板 |

## 隐私

- 默认使用占位符数据
- 运行时通过 Playwright 自动登录校园网获取真实数据
- 所有数据仅存储在本地，不上传任何服务器
- MAC/IP 地址自动脱敏显示

## 许可

MIT License
