# CAUCNet Traffic

> Campus network real-time traffic monitoring tool for Civil Aviation University of China (CAUC)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14-green.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)
[![Zero Dependencies (Frontend)](https://img.shields.io/badge/Frontend-Zero%20Dependencies-brightgreen.svg)](https://github.com/WuSuBuDuoMing/CAUCNet-Traffic)

[简体中文](README.zh-CN.md)

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [API Reference](#api-reference)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Privacy & Security](#privacy--security)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Real-time Network Speed** -- Live upload and download speed monitoring
- **Traffic Overview** -- Summary of total data usage across the campus network
- **24-Hour Traffic Trend** -- Historical traffic visualization over the past 24 hours using Canvas 2D charts
- **Online Device Management** -- View and manage connected devices on the network
- **Login Status** -- Monitor campus network authentication state
- **Connection Quality (Ping)** -- Test and display network latency and quality
- **Speed Test** -- Cloudflare-based bandwidth testing
- **Dark Mode** -- Manual toggle and automatic system-preference detection
- **Keyboard Shortcuts** -- Quick access to common actions via hotkeys
- **Data Export** -- Export traffic data in CSV, JSON, or TXT format
- **Threshold Alerts** -- Configurable alerts when traffic exceeds set limits
- **Data Backup** -- Backup and restore monitoring data
- **Responsive Design** -- Works on desktop, tablet, and mobile screens
- **Accessibility** -- Built with ARIA attributes and keyboard navigation support
- **Server-Sent Events** -- Real-time data push without polling

---

## Quick Start

### Prerequisites

- **Node.js** >= 14
- **Windows OS** (uses `Get-NetAdapterStatistics` for local network stats)
- **Playwright** (optional, for automatic campus network login)

### Installation

```bash
# Clone the repository
git clone https://github.com/WuSuBuDuoMing/CAUCNet-Traffic.git
cd CAUCNet-Traffic

# Install dependencies
npm install

# (Optional) Install Playwright for auto-login
npx playwright install chromium
```

### Configuration

Copy the example configuration file and adjust values as needed:

```bash
cp config.example.js config.js
```

Edit `config.js` to set your campus network credentials and preferences.

### Run

```bash
# Start the server
node server.js

# The dashboard will be available at
# http://localhost:3000
```

---

## Tech Stack

| Layer        | Technology                                                              |
| ------------ | ----------------------------------------------------------------------- |
| Backend      | Node.js + Express                                                       |
| Frontend     | Vanilla HTML / CSS / JavaScript (zero dependencies)                     |
| Charts       | Canvas 2D                                                               |
| Real-time    | Server-Sent Events (SSE)                                                |
| Network Data | Windows `Get-NetAdapterStatistics` + CAUC Campus Network API            |
| Auto-login   | Playwright (headless Chromium)                                          |

### Architecture Overview

```text
+---------------------+        SSE         +------------------+
|   Express Backend   | -----------------> |   Browser Client |
|                     | <---- REST API --- |  (Vanilla JS)    |
+---------------------+                    +------------------+
        |                                          |
        v                                          v
  Windows Network                          Canvas 2D Charts
  + Campus API                             Export / Alerts
```

---

## API Reference

All endpoints are served from the Express backend.

| Endpoint                | Method | Description                                     |
| ----------------------- | ------ | ----------------------------------------------- |
| `/api/speed`            | GET    | Current upload and download speed               |
| `/api/overview`         | GET    | Traffic usage summary                           |
| `/api/devices`          | GET    | List of online devices                          |
| `/api/devices/:id/logout` | POST | Logout (deactivate) a device                   |
| `/api/stats`            | GET    | Today and monthly traffic statistics            |
| `/api/trend`            | GET    | 24-hour traffic trend data                      |
| `/api/thresholds`       | GET    | Get threshold alert settings                    |
| `/api/thresholds`       | POST   | Update threshold alert settings                 |
| `/api/login-status`     | GET    | Campus network login status                     |
| `/api/quality`          | GET    | Connection quality and latency metrics          |
| `/api/speedtest`        | GET    | Trigger a Cloudflare speed test                 |
| `/api/health`           | GET    | Server health check                             |
| `/api/stream`           | GET    | SSE endpoint for real-time data push            |
| `/api/network-info`     | GET    | Active network adapter information              |
| `/api/ip-info`          | GET    | IP geolocation info                             |
| `/api/bandwidth-analysis` | GET  | Bandwidth usage analysis and projection         |
| `/api/traffic-forecast` | GET    | Traffic usage forecast                          |
| `/api/anomalies`        | GET    | Anomaly detection results                       |
| `/api/history`          | GET    | Traffic history (query param: `hours`)          |
| `/api/settings`         | GET    | Get app settings                                |
| `/api/settings`         | POST   | Update app settings                             |
| `/api/backup`           | GET    | Download data backup                            |
| `/api/report`           | GET    | Generate usage report                           |

### Example

```bash
# Get current network speed
curl http://localhost:3000/api/speed

# Get 24-hour traffic trend
curl http://localhost:3000/api/trend

# Health check
curl http://localhost:3000/api/health
```

---

## Keyboard Shortcuts

| Key   | Action                                    |
| ----- | ----------------------------------------- |
| `?`   | Open help / shortcut reference            |
| `D`   | Toggle dark mode                          |
| `R`   | Refresh current data                      |
| `E`   | Export traffic data as CSV                |
| `Esc` | Close modals and overlays                 |

---

## Privacy & Security

CAUCNet Traffic is designed with privacy as a core principle:

- **Placeholder Data by Default** -- The dashboard uses placeholder data when no real connection is available, so you can explore the UI without credentials.
- **Auto-login via Playwright** -- Campus network authentication is handled locally through headless browser automation. Credentials never leave your machine.
- **Local-only Storage** -- All traffic data is stored locally on the server. No data is sent to external services.
- **MAC / IP Auto-masking** -- MAC addresses and IP addresses are automatically masked in the UI and exports to prevent accidental exposure.
- **No Third-party Analytics** -- The frontend contains zero external dependencies and no tracking scripts.

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**[Back to top](#caucnet-traffic)**

</div>
