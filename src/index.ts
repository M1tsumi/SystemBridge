export { SystemBridge } from './core/systemBridge.js';
export type { SystemBridgeOptions } from './core/systemBridge.js';

export type { Logger, LogLevel } from './core/logging.js';
export type {
  FileWatchOptions,
  FileSystemEvent,
  FileWatchSubscription
} from './modules/fileWatcher/index.js';
export type {
  ProcessFilter,
  ProcessInfo,
  LaunchProcessOptions,
  ManagedProcess,
  KillProcessResult
} from './modules/processManager/index.js';
export type { NotificationOptions, NotificationResult } from './modules/notifier/index.js';
export type {
  ClipboardFormats,
  ClipboardModule,
  ClipboardReadOptions
} from './modules/clipboard/index.js';
export type { SystemSnapshot } from './modules/systemInfo/index.js';
