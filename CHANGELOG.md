# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.0] - 2026-06-18

### Added
- Comprehensive README overhaul with Installation, Usage, API, Contributing, Code of Conduct, and Security Policy sections
- JSDoc `@route` annotations for all 23 REST API endpoints in server.js
- Full JSDoc documentation for TrafficSimulator class with `@class`, `@example`, and typed `@returns` on all public methods
- JSDoc `@type` annotations for all instance properties in TrafficSimulator
- CI matrix testing across Node.js 18, 20, and 22
- Enhanced CONTRIBUTING.md with Table of Contents, `npm test` instructions, and updated branch conventions
- Expanded SECURITY.md with severity-based response timeline, supported versions table, deployment best practices, and scope definition
- Full Contributor Covenant Code of Conduct v2.0 (CODE_OF_CONDUCT.md)

### Changed
- README.md: added CI badge, npm badge, Environment Variables table, Usage section, Code of Conduct/Security Policy sections
- CI workflow now triggers on both `main` and `master` branches
- All user-facing strings in server.js translated to English for consistency
- Upgraded CONTRIBUTING.md issue links to correct repository URL

## [1.9.0] - 2026-06-17

### Changed
- server.js: translated all Chinese comments to English for international readability
- services/simulator.js: translated Chinese comments and placeholder data to English
- Module-level JSDoc added to server.js (`@module server`)
- Module-level JSDoc added to services/simulator.js (`@module services/simulator`)
- `broadcastSSE` function documented with JSDoc `@param` tags

### Fixed
- Anomaly endpoint messages translated to English for API consistency

## [1.8.0] - 2026-06-16

### Added
- Bandwidth analysis endpoint (`/api/bandwidth-analysis`) with daily average and monthly projection
- Traffic forecast endpoint (`/api/traffic-forecast`) with 24-hour and monthly predictions
- Anomaly detection endpoint (`/api/anomalies`) for speed and latency monitoring
- Traffic history endpoint (`/api/history`) with configurable time window
- Application settings endpoints (`GET/POST /api/settings`) for runtime configuration
- Data backup endpoint (`/api/backup`) for JSON export of settings and stats
- Usage report endpoint (`/api/report`) for comprehensive network report generation
- Network adapter info endpoint (`/api/network-info`)
- IP geolocation endpoint (`/api/ip-info`)
- Connection quality endpoint (`/api/quality`) with latency measurement
- Speed test endpoint (`/api/speedtest`) via Cloudflare

### Changed
- API endpoints expanded from 9 to 23 total routes
- README API Reference table updated with all new endpoints
- CHANGELOG entries reordered to newest-first

## [1.7.0] - 2026-06-16

### Added
- Code of Conduct (CODE_OF_CONDUCT.md) based on Contributor Covenant v2.1
- GitHub Sponsors funding configuration (FUNDING.yml)
- CODEOWNERS file for code review assignments
- Enhanced Issue and PR templates

## [1.5.0] - 2026-06-14

### Added
- Security policy (SECURITY.md)
- Documentation enhancements
- Open-source best practices

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
