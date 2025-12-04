import notifier, {
  type Notification as NodeNotifierPayload,
  type NotificationCallback,
  type NotificationMetadata
} from 'node-notifier';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, type Logger } from '../../core/logging.js';
import { SystemBridgeError, UnsupportedOperationError } from '../../core/errors.js';

export type NotificationPriority = 'low' | 'default' | 'high';

export interface NotificationAction {
  id: string;
  label: string;
}

export interface NotificationOptions {
  title: string;
  message: string;
  subtitle?: string;
  icon?: string;
  sound?: boolean | string;
  waitForAction?: boolean;
  priority?: NotificationPriority;
  actions?: NotificationAction[];
  closeLabel?: string;
  timeoutMs?: number;
}

export interface NotificationResult {
  activationType: 'action' | 'dismissed' | 'timeout';
  actionId?: string;
  metadata?: NotificationMetadata;
}

interface NotifierOptions {
  logger?: Logger;
}

type ExtendedNotifierPayload = NodeNotifierPayload & {
  subtitle?: string;
  sound?: boolean | string;
  wait?: boolean;
  timeout?: number;
  actions?: string[];
  closeLabel?: string;
};

export class Notifier {
  private readonly logger;
  private readonly supportsActions: boolean;
  private disposed = false;

  constructor(options: NotifierOptions = {}) {
    this.logger = createLogger(options.logger);
    this.supportsActions = process.platform === 'win32' || process.platform === 'darwin';
  }

  isSupported(): boolean {
    if (process.platform === 'linux') {
      return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
    }
    return true;
  }

  async notify(options: NotificationOptions): Promise<NotificationResult> {
    if (!this.isSupported()) {
      throw new UnsupportedOperationError('Notifications are not supported on this environment');
    }

    const payload: ExtendedNotifierPayload = {
      title: options.title,
      message: options.message,
      subtitle: options.subtitle,
      icon: options.icon ? this.resolveIcon(options.icon) : undefined,
      sound: options.sound,
      wait: options.waitForAction ?? Boolean(options.actions?.length),
      timeout: options.timeoutMs ? Math.round(options.timeoutMs / 1000) : undefined,
      actions: this.supportsActions ? options.actions?.map((action) => action.label) : undefined,
      closeLabel: options.closeLabel
    };

    return new Promise<NotificationResult>((resolve, reject) => {
      const handleResult: NotificationCallback = (error, response, metadata) => {
        if (error) {
          reject(new SystemBridgeError('Notification failed', 'OPERATION_FAILED', error));
          return;
        }

        const result = this.mapResult(response ?? '', metadata, options);
        resolve(result);
      };

      try {
        notifier.notify(payload, handleResult);
      } catch (error) {
        reject(new SystemBridgeError('Notification dispatch errored', 'OPERATION_FAILED', error));
      }
    });
  }

  dispose(): void {
    this.disposed = true;
  }

  private mapResult(response: string, metadata: NotificationMetadata | undefined, options: NotificationOptions): NotificationResult {
    if (response === 'timeout') {
      return { activationType: 'timeout', metadata };
    }

    if (response === 'dismissed') {
      return { activationType: 'dismissed', metadata };
    }

    if (response.startsWith('activate')) {
      const activationValue = metadata?.activationValue ?? response;
      const resolvedAction = options.actions?.find(
        (action) => action.id === activationValue || action.label === activationValue
      );

      return {
        activationType: 'action',
        actionId: resolvedAction?.id,
        metadata
      };
    }

    return { activationType: 'dismissed', metadata };
  }

  private resolveIcon(iconPath: string): string {
    if (iconPath.startsWith('file://')) {
      return fileURLToPath(iconPath);
    }
    if (path.isAbsolute(iconPath)) {
      return iconPath;
    }
    return path.join(process.cwd(), iconPath);
  }
}
