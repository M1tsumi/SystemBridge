# Changelog

All notable changes to this project will be documented in this file.

The format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Added
- Initial cross-platform `SystemBridge` facade wiring file watching, process management, notifications, clipboard, and system telemetry modules.
- File watcher module with chokidar-based event normalization, glob filtering, debouncing, and safe teardown APIs.
- Process manager supporting process enumeration/filtering, spawn/kill orchestration, AbortSignal-aware launches, and resource sampling via `pidusage`.
- Native notification adapter with capability detection, rich payload (subtitle/icon/sound), and action button callbacks using `node-notifier`.
- Clipboard abstraction providing text/HTML read/write plus format discovery and Linux headless guards.
- System information snapshotter that aggregates CPU, memory, load, network, and best-effort battery data with caching + per-OS helpers.
- Shared utilities (logging, typed errors, exec wrapper) and Vitest-powered unit test suite with coverage configuration.
- Developer documentation (README) describing features, install instructions, capability matrix, examples, and development workflows.

### Tooling
- Dual ESM/CJS TypeScript build pipeline with declaration output, ESLint + Prettier setup, and npm scripts for lint/test/build/docs/release automation.
- Example scripts scaffold in `examples/` for quick-start orchestration and process monitoring demos.
