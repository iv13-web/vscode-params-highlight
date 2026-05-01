# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-01

### Added
- Function parameter highlighting for TypeScript, JavaScript, TSX, and JSX.
- Scope-aware AST traversal that handles shadowing across nested functions.
- Detection of parameters in shorthand object properties, destructuring, rest parameters, and JSX expressions.
- Support for TypeScript parameter properties (`this.x` access where `x` is declared via `private`/`public`/`protected`/`readonly` constructor parameters).
- Configuration panel (`Params Highlight: Configure Style`) with color picker, italic/bold toggles, and a live preview.
- Global settings: `paramsHighlight.color`, `paramsHighlight.italic`, `paramsHighlight.bold`, `paramsHighlight.maxFileSize`.
- One-time-per-file warning when a file exceeds the size limit (default 512 KB, hard cap 5 MB).
- One-time-per-file warning when a file exceeds the parser depth limit (1000 AST levels) — protects against pathological or generated input without crashing the extension host.
- Workspace trust declaration: extension runs in untrusted workspaces because it never executes user-controlled data.
- Strict webview CSP, sanitized color whitelist, and JSON-in-script escaping for defense-in-depth.

[Unreleased]: https://github.com/iv13-web/vscode-params-highlight/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/iv13-web/vscode-params-highlight/releases/tag/v0.1.0
