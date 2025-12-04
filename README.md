# SystemBridge

SystemBridge is a unified, type-safe Node.js API that abstracts platform-specific system operations (file watching, process management, notifications, clipboard, telemetry, etc.) behind a single facade. It targets Windows, macOS, and Linux so apps can ship cross-platform automation without OS-specific code paths.

## Features

- **File watchers** powered by `chokidar` with glob filtering, debouncing, and graceful teardown
- **Process lifecycle management** for listing, spawning, terminating, and sampling resource usage
- **Native notifications** with action support and capability detection
- **Clipboard abstraction** for text + HTML with auto capability detection
- **System telemetry** snapshot (CPU, memory, network, battery) with caching
- **Consistent logging and error primitives**

## Requirements

- Node.js >= 18 (uses modern `fs/promises`, `AbortController`, and ESM)
- Works without admin/root privileges
- Optional desktop dependencies: `notify-send` (Linux notifications), X11/Wayland display for clipboard/notifications

## Installation

```bash
npm install systembridge
# or
yarn add systembridge
```

## Quick Start

```ts
import { SystemBridge } from 'systembridge';

async function main() {
  const bridge = new SystemBridge({
    fileWatcherDefaults: {
      debounceMs: 75,
      ignores: ['node_modules', '.git']
    }
  });

  const watcher = bridge.fileWatcher.subscribe(
    (event) => console.log('[fs]', event.type, event.relativePath),
    { paths: process.cwd(), debounceMs: 100 }
  );

  const topNodeProcesses = await bridge.processManager.listProcesses({ nameIncludes: 'node' });
  console.log('Top process:', topNodeProcesses[0]);

  if (bridge.capabilities().notifications) {
    await bridge.notifier.notify({ title: 'SystemBridge', message: 'Automation ready!' });
  }

  const snapshot = await bridge.systemInfo.snapshot();
  console.log('CPU count:', snapshot.cpus.length, 'Memory utilization:', snapshot.memory.utilization);

  await watcher.close();
  await bridge.shutdown();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

## Capability Matrix

| Feature | Windows 10+ | macOS 12+ | Ubuntu 22.04+ | Alpine Linux |
|---------|-------------|-----------|---------------|--------------|
| File Watching | ✅ | ✅ | ✅ | ✅ |
| Process List / Spawn / Kill | ✅ | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ (needs `notify-send`) | ⚠️ Limited |
| Clipboard – Text | ✅ | ✅ | ✅ | ⚠️ X11 required |
| Clipboard – HTML | ✅ | ✅ | ⚠️ X11 only | ❌ |
| System Info Snapshot | ✅ | ✅ | ✅ | ✅ |

## Module Overview

- **FileWatcher** – wraps `chokidar` and normalizes events into `{ type, path, relativePath, stats }`. Supports recursive watchers, ignores, depth limits, and AbortSignal tear down.
- **ProcessManager** – uses `ps-list`, native spawn/kill, and `pidusage` for resource snapshots. Provides filtering helpers (`nameIncludes`, `binaryPathIncludes`, `user`).
- **Notifier** – surfaces native toast APIs via `node-notifier` with capability detection plus optional action buttons.
- **ClipboardModule** – wraps `clipboardy` with optional HTML read/write when supported.
- **SystemInfoModule** – aggregates CPU/memory/network telemetry and best-effort battery info (WMI, pmset, /sys/class/power_supply) with caching.

## Examples

Example scripts live in [`examples/`](examples/):

1. `examples/quick-start.ts` – end-to-end orchestration sample covering watchers, processes, notifier, clipboard, and system info.
2. `examples/process-monitor.ts` – lists processes, samples resource usage, and prints a live summary.

Run an example with ts-node or tsx:

```bash
npx tsx examples/quick-start.ts
```

## Testing

Unit tests use [Vitest](https://vitest.dev). To run the suite:

```bash
npm test
```


We follow SemVer once `1.0.0` is released. Until then expect minor breaking changes during `0.x` releases. Contributions and bug reports are welcome—please include OS/environment details when filing issues.
