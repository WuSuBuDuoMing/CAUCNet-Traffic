# Contributing to CAUCNet Traffic

Thank you for your interest in contributing to CAUCNet Traffic! This document provides guidelines and steps for contributing.

感谢你对 CAUCNet Traffic 项目的关注！本文档提供了参与贡献的指南和步骤。

---

## Development Setup / 开发环境搭建

### Prerequisites / 前置要求

- [Node.js](https://nodejs.org/) 18 or later / Node.js 18 或更高版本
- [Git](https://git-scm.com/) / Git 版本控制工具

### Getting Started / 快速开始

```bash
# 1. Fork and clone the repository / Fork 并克隆仓库
git clone https://github.com/<your-username>/CAUCNet-Traffic.git
cd CAUCNet-Traffic

# 2. Install dependencies / 安装依赖
npm install

# 3. Start the development server / 启动开发服务器
npm start

# 4. Open your browser / 打开浏览器
# Visit http://localhost:3000
# 访问 http://localhost:3000
```

---

## Coding Conventions / 代码规范

### JavaScript

- Use `const` and `let`; avoid `var` / 使用 `const` 和 `let`，避免使用 `var`
- Use meaningful variable and function names / 使用有意义的变量和函数名
- Add comments for complex logic / 为复杂逻辑添加注释
- Keep functions small and focused / 保持函数简洁和单一职责

### HTML & CSS

- Use semantic HTML elements / 使用语义化 HTML 标签
- Include ARIA labels for accessibility / 为无障碍访问添加 ARIA 标签
- Support dark mode via `data-theme="dark"` attribute / 通过 `data-theme="dark"` 属性支持深色模式
- Use CSS custom properties (variables) for theming / 使用 CSS 自定义属性（变量）实现主题

### General / 通用

- No trailing whitespace / 不留尾部空格
- Use consistent indentation (2 spaces) / 使用一致的缩进（2 个空格）
- Keep lines under 120 characters / 每行不超过 120 个字符

---

## Commit Convention / 提交规范

This project follows [Conventional Commits](https://www.conventionalcommits.org/). All commit messages must follow this format:

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。所有提交信息必须遵循以下格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types / 类型

| Type       | Description                   | 描述         |
|------------|-------------------------------|-------------|
| `feat`     | New feature                   | 新功能       |
| `fix`      | Bug fix                       | Bug 修复     |
| `docs`     | Documentation                 | 文档更新     |
| `style`    | Code style (no logic change)  | 代码格式     |
| `refactor` | Code refactoring              | 代码重构     |
| `perf`     | Performance improvement        | 性能优化     |
| `test`     | Tests                         | 测试         |
| `chore`    | Build/tooling changes         | 构建/工具    |

### Examples / 示例

```
feat: add dark mode toggle to header
fix: correct traffic calculation for IPv6
docs: update README with deployment instructions
style: format CSS with consistent indentation
```

---

## Pull Request Process / Pull Request 流程

### Before Submitting / 提交前

1. Create a new branch from `master` / 从 `master` 创建新分支
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes / 进行修改
3. Test thoroughly in the browser / 在浏览器中充分测试
   - Test both light and dark mode / 测试亮色和深色模式
   - Test on different screen sizes / 测试不同屏幕尺寸
   - Verify no console errors / 确认无控制台错误
4. Commit with a conventional commit message / 使用规范提交信息
5. Push to your fork / 推送到你的 Fork
   ```bash
   git push origin feat/your-feature-name
   ```

### Submitting a PR / 提交 PR

1. Open a Pull Request against the `master` branch / 向 `master` 分支发起 Pull Request
2. Fill in the PR template completely / 完整填写 PR 模板
3. Link any related issues / 关联相关 Issue
4. Wait for review and address feedback / 等待审核并处理反馈

---

## Reporting Issues / 报告问题

- Use the [Bug Report](https://github.com/CAUCNet/Traffic/issues/new?template=bug_report.md) template for bugs / 使用 Bug 报告模板报告问题
- Use the [Feature Request](https://github.com/CAUCNet/Traffic/issues/new?template=feature_request.md) template for suggestions / 使用功能请求模板提出建议
- Search existing issues before creating a new one / 创建新 Issue 前先搜索已有 Issue

---

## Questions? / 有疑问？

If you have questions, feel free to open an issue or reach out to the maintainers.

如有疑问，欢迎创建 Issue 或联系项目维护者。
