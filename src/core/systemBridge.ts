import os from 'node:os';
import { createLogger, Logger } from './logging.js';
import { FileWatcher, type FileWatchOptions } from '../modules/fileWatcher/index.js';
import { ProcessManager } from '../modules/processManager/index.js';
import { Notifier } from '../modules/notifier/index.js';
import { ClipboardModule } from '../modules/clipboard/index.js';
import { SystemInfoModule } from '../modules/systemInfo/index.js';

export interface SystemBridgeOptions {
  logger?: Logger;
  fileWatcherDefaults?: Omit<FileWatchOptions, 'paths'>;
}

export interface SystemCapabilities {
  fileWatching: boolean;
  processManagement: boolean;
  notifications: boolean;
  clipboard: boolean;
  systemInfo: boolean;
}

export class SystemBridge {
  readonly logger;
  readonly fileWatcher: FileWatcher;
  readonly processManager: ProcessManager;
  readonly notifier: Notifier;
  readonly clipboard: ClipboardModule;
  readonly systemInfo: SystemInfoModule;

  private readonly options: SystemBridgeOptions;

  constructor(options: SystemBridgeOptions = {}) {
    this.options = options;
    this.logger = createLogger(options.logger);

    this.fileWatcher = new FileWatcher({ logger: this.logger, defaultOptions: options.fileWatcherDefaults });
    this.processManager = new ProcessManager({ logger: this.logger });
    this.notifier = new Notifier({ logger: this.logger });
    this.clipboard = new ClipboardModule({ logger: this.logger });
    this.systemInfo = new SystemInfoModule({ logger: this.logger });
  }

  get platform() {
    return os.platform();
  }

  capabilities(): SystemCapabilities {
    return {
      fileWatching: true,
      processManagement: true,
      notifications: this.notifier.isSupported(),
      clipboard: this.clipboard.isSupported(),
      systemInfo: true
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down SystemBridge modules');
    await Promise.allSettled([
      this.fileWatcher.dispose(),
      this.processManager.dispose(),
      this.notifier.dispose(),
      this.clipboard.dispose(),
      this.systemInfo.dispose()
    ]);
  }
}
