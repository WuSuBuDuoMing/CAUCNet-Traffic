# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-09

### Added

- **Real-time Speed Monitoring** - Live upload/download speed display with instant updates
- **Traffic Overview Dashboard** - Total traffic usage summary with visual indicators
- **24-Hour Traffic Trend** - Historical traffic chart showing the last 24 hours of data usage
- **Online Devices List** - Real-time view of currently connected devices on the campus network
- **Login Status Panel** - Campus network authentication status display
- **Connection Quality Indicator** - Network latency and connection quality metrics
- **Speed Test** - Built-in network speed test functionality
- **Dark Mode** - Full dark mode support with system preference detection and manual toggle
- **Keyboard Shortcuts** - Quick actions via keyboard shortcuts for power users
- **Data Export** - Export traffic data and statistics to CSV format
- **Threshold Alerts** - Configurable traffic usage alerts and notifications
- **Responsive Design** - Fully responsive layout for desktop, tablet, and mobile devices
- **Accessibility** - WCAG-compliant accessibility features including ARIA labels and keyboard navigation

### Technical

- Node.js + Express backend with RESTful API routes
- Vanilla HTML/CSS/JS frontend (no framework dependencies)
- CORS-enabled API for cross-origin requests
- Dockerfile included for containerized deployment

## [1.1.0] - 2026-06-10

### Added
- English README with comprehensive documentation and API reference
- Chinese README (README.zh-CN.md)
- GitHub Actions CI workflow (validate + syntax check)
- Issue templates (Bug Report, Feature Request)
- Pull Request template
- CHANGELOG.md (this file)
- CONTRIBUTING.md (bilingual English/Chinese)
- npm package (`caucnet-traffic`) published to npm registry
- npm publish workflow (publish.yml)
- Website and Topics added to GitHub repository
- Multi-platform installation guide (macOS, Linux, Windows, Docker)

### Changed
- Repository made public for open-source community
- All commit authors unified to WuSuBuDuoMing

## [1.3.0] - 2026-06-14

### Changed
- Local optimization and performance improvements
- CHANGELOG sync across repositories
- npm package published
- Documentation improvements

## [1.2.0] - 2026-06-11

### Added
- Test suite using Node.js built-in test runner (44 tests)
  - TrafficSimulator unit tests: constructor, getSpeed, getOverview, getDevices, logoutDevice, getStats, getTrend, thresholds, loginStatus, tick
  - API integration tests: all 17 REST endpoints with supertest
- JSDoc documentation for all public methods in TrafficSimulator
- JSDoc for server.js module and broadcastSSE function
- Full API reference in README.md (23 endpoints, up from 9)
- Full API reference in README.zh-CN.md (21 endpoints, up from 9)

### Changed
- Updated express dependency from ^4.18.2 to ^4.21.2
- Moved all `require()` calls to top of server.js (net, https, child_process)
- Server version banner now reads from package.json instead of hardcoded string
- Added `test` script to package.json

### Fixed
- Removed redundant inline `require()` calls in route handlers (net, https, execSync)
