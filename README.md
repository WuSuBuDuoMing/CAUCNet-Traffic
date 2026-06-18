# CAUCNet Traffic

> Real-time campus network traffic monitoring dashboard for Civil Aviation University of China (CAUC)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![CI](https://github.com/WuSuBuDuoMing/CAUCNet-Traffic/actions/workflows/ci.yml/badge.svg)](https://github.com/WuSuBuDuoMing/CAUCNet-Traffic/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/caucnet-traffic.svg)](https://www.npmjs.com/package/caucnet-traffic)
[![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)
[![Zero Dependencies (Frontend)](https://img.shields.io/badge/Frontend-Zero%20Dependencies-brightgreen.svg)](https://github.com/WuSuBuDuoMing/CAUCNet-Traffic)

[简体中文](README.zh-CN.md)

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Tech Stack](#tech-stack)
- [API Reference](#api-reference)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Privacy & Security](#privacy--security)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Security Policy](#security-policy)
- [License](#license)

---

## Features

- **Real-time Network Speed** -- Live upload and download speed monitoring with peak tracking
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
- **Bandwidth Analysis** -- Average daily usage and monthly projection
- **Traffic Forecast** -- Remaining 24-hour and monthly traffic predictions
- **Anomaly Detection** -- Automatic detection of unusual speed and latency patterns
- **Usage Reports** -- Generate comprehensive network usage reports
- **Responsive Design** -- Works on desktop, tablet, and mobile screens
- **Accessibility** -- Built with ARIA attributes and keyboard navigation support
- **Server-Sent Events** -- Real-time data push without polling
- **Zero Frontend Dependencies** -- Pure vanilla HTML/CSS/JS, no framework bloat

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **Windows OS** (uses `Get-NetAdapterStatistics` for local network stats)
- **Playwright** (optional, for automatic campus network login)

### Installation

#### From Source

```bash
# Clone the repository
git clone https://github.com/WuSuBuDuoMing/CAUCNet-Traffic.git
cd CAUCNet-Traffic

# Install dependencies
npm install

# (Optional) Install Playwright for auto-login
npx playwright install chromium
```

#### From npm

```bash
npm install -g caucnet-traffic
```

#### Using Docker

```bash
docker build -t caucnet-traffic .
docker run -p 3000:3000 caucnet-traffic
```

### Configuration

Copy the example configuration file and adjust values as needed:

```bash
cp config.example.js config.js
```

Edit `config.js` to set your campus network credentials and preferences.

---

## Usage

### Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The dashboard will be available at `http://localhost:3000`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3004`  | Server listening port |

### Run Tests

```bash
npm test
```

The project uses Node.js built-in test runner with 44+ tests covering the traffic simulator and all API endpoints.

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
| Testing      | Node.js built-in test runner + supertest                                |
| CI/CD        | GitHub Actions                                                          |

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

| Endpoint                  | Method | Description                                     |
| ------------------------- | ------ | ----------------------------------------------- |
| `/api/speed`              | GET    | Current upload and download speed               |
| `/api/overview`           | GET    | Traffic usage summary                           |
| `/api/devices`            | GET    | List of online devices                          |
| `/api/devices/:id/logout` | POST   | Logout (deactivate) a device                    |
| `/api/stats`              | GET    | Today and monthly traffic statistics            |
| `/api/trend`              | GET    | 24-hour traffic trend data                      |
| `/api/thresholds`         | GET    | Get threshold alert settings                    |
| `/api/thresholds`         | POST   | Update threshold alert settings                 |
| `/api/login-status`       | GET    | Campus network login status                     |
| `/api/quality`            | GET    | Connection quality and latency metrics          |
| `/api/speedtest`          | GET    | Trigger a Cloudflare speed test                 |
| `/api/health`             | GET    | Server health check                             |
| `/api/stream`             | GET    | SSE endpoint for real-time data push            |
| `/api/network-info`       | GET    | Active network adapter information              |
| `/api/ip-info`            | GET    | IP geolocation info                             |
| `/api/bandwidth-analysis` | GET    | Bandwidth usage analysis and projection         |
| `/api/traffic-forecast`   | GET    | Traffic usage forecast                          |
| `/api/anomalies`          | GET    | Anomaly detection results                       |
| `/api/history`            | GET    | Traffic history (query param: `hours`)          |
| `/api/settings`           | GET    | Get app settings                                |
| `/api/settings`           | POST   | Update app settings                             |
| `/api/backup`             | GET    | Download data backup                            |
| `/api/report`             | GET    | Generate usage report                           |

### Examples

```bash
# Get current network speed
curl http://localhost:3000/api/speed

# Get 24-hour traffic trend
curl http://localhost:3000/api/trend

# Get anomaly detection results
curl http://localhost:3000/api/anomalies

# Download data backup
curl http://localhost:3000/api/backup -o backup.json

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

For vulnerability reports, see [SECURITY.md](SECURITY.md).

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

Quick steps:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feat/my-feature`
5. Open a Pull Request.

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming and inclusive community.

---

## Security Policy

Please see [SECURITY.md](SECURITY.md) for reporting vulnerabilities and supported versions.

---

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2024-2026 [WuSuBuDuoMing](https://github.com/WuSuBuDuoMing)

---

<div align="center">

**[Back to top](#caucnet-traffic)**

</div>
