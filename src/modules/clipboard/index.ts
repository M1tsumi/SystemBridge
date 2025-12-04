import clipboard from 'clipboardy';
import { createLogger, type Logger } from '../../core/logging.js';
import { UnsupportedOperationError } from '../../core/errors.js';

export type ClipboardFormat = 'text' | 'html';
export type ClipboardFormats = ClipboardFormat[];

type ExtendedClipboard = typeof clipboard & {
  readHTML?: () => Promise<string>;
  writeHTML?: (html: string) => Promise<void>;
};

const extendedClipboard = clipboard as ExtendedClipboard;

export interface ClipboardReadOptions {
  format?: ClipboardFormat;
}

export interface ClipboardWriteOptions {
  format?: ClipboardFormat;
}

interface ClipboardModuleOptions {
  logger?: Logger;
}

export class ClipboardModule {
  private readonly logger;

  constructor(options: ClipboardModuleOptions = {}) {
    this.logger = createLogger(options.logger);
  }

  isSupported(): boolean {
    if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
      return false;
    }
    return true;
  }

  async read(options: ClipboardReadOptions = {}): Promise<string> {
    if (!this.isSupported()) {
      throw new UnsupportedOperationError('Clipboard is not available in this environment');
    }

    const format = options.format ?? 'text';
    this.logger.debug('Reading clipboard', { format });

    if (format === 'text') {
      return clipboard.read();
    }

    if (format === 'html') {
      const htmlValue = await extendedClipboard.readHTML?.();
      return htmlValue ?? clipboard.read();
    }

    throw new UnsupportedOperationError(`Unsupported clipboard format: ${format}`);
  }

  async write(content: string, options: ClipboardWriteOptions = {}): Promise<void> {
    if (!this.isSupported()) {
      throw new UnsupportedOperationError('Clipboard is not available in this environment');
    }

    const format = options.format ?? 'text';
    this.logger.debug('Writing clipboard', { format });

    if (format === 'text') {
      await clipboard.write(content);
      return;
    }

    if (format === 'html' && extendedClipboard.writeHTML) {
      await extendedClipboard.writeHTML(content);
      return;
    }

    throw new UnsupportedOperationError(`Unsupported clipboard format: ${format}`);
  }

  async clear(): Promise<void> {
    if (!this.isSupported()) {
      throw new UnsupportedOperationError('Clipboard is not available in this environment');
    }
    await clipboard.write('');
  }

  getFormats(): ClipboardFormats {
    const formats: ClipboardFormats = ['text'];
    if (extendedClipboard.readHTML && extendedClipboard.writeHTML) {
      formats.push('html');
    }
    return formats;
  }

  dispose(): void {
    // nothing to cleanup yet
  }
}
