# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in CAUCNet Traffic, please report it responsibly:

1. **DO NOT** open a public GitHub issue for security vulnerabilities.
2. Use [GitHub's private vulnerability reporting](https://github.com/WuSuBuDuoMing/CAUCNet-Traffic/security/advisories/new) to submit your report.
3. Alternatively, email the maintainer at WuSuBuDuoMing@users.noreply.github.com.
4. Include a detailed description of the vulnerability, steps to reproduce, and the potential impact.

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.10.x  | :white_check_mark: |
| 1.9.x   | :white_check_mark: |
| < 1.9   | :x:                |

## Response Timeline

| Severity | Response Time  |
|----------|----------------|
| Critical | 24-48 hours    |
| High     | 3-5 days       |
| Medium   | 7 days         |
| Low      | 14 days        |

## Security Best Practices

When deploying CAUCNet Traffic:

- **Keep dependencies updated**: Run `npm audit` regularly and update packages.
- **Use environment variables**: Never hardcode credentials in source code.
- **Network isolation**: Run the server behind a reverse proxy or firewall.
- **HTTPS**: Use TLS in production environments.
- **Access control**: Restrict dashboard access to trusted networks.

## Scope

The following are in scope for security reports:

- Remote code execution
- Authentication bypass
- Data exposure of user credentials or network information
- Cross-site scripting (XSS) in the dashboard
- Server-side request forgery (SSRF)
- Dependency vulnerabilities with demonstrable impact

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve the project's security.

Thank you for helping keep CAUCNet Traffic safe!
