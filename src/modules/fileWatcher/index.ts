import chokidar, { type FSWatcher } from 'chokidar';
import type { Stats } from 'node:fs';
import path from 'node:path';
import { createLogger, type Logger } from '../../core/logging.js';

export type FileSystemEventType = 'create' | 'change' | 'delete' | 'directory';

export interface FileSystemEvent {
  type: FileSystemEventType;
  path: string;
  relativePath?: string;
  stats?: Stats;
}

export interface FileWatchOptions {
  paths: string | string[];
  ignores?: string[];
  debounceMs?: number;
  cwd?: string;
  depth?: number;
}

export type FileWatchHandler = (event: FileSystemEvent) => void;

export interface FileWatchSubscription {
  close(): Promise<void>;
}

export interface FileWatcherOptions {
  logger?: Logger;
  defaultOptions?: Omit<FileWatchOptions, 'paths'>;
}

interface ActiveWatcher {
  watcher: FSWatcher;
  flush(): void;
}

export class FileWatcher {
  private readonly logger;
  private readonly defaultOptions?: Omit<FileWatchOptions, 'paths'>;
  private readonly activeWatchers = new Set<ActiveWatcher>();

  constructor(options: FileWatcherOptions = {}) {
    this.logger = createLogger(options.logger);
    this.defaultOptions = options.defaultOptions;
  }

  subscribe(handler: FileWatchHandler, options: FileWatchOptions): FileWatchSubscription {
    const merged = { ...this.defaultOptions, ...options } as FileWatchOptions;
    const { paths, ignores, debounceMs = 50, cwd = process.cwd(), depth } = merged;
    const watchPaths = Array.isArray(paths) ? paths : [paths];

    const watcher = chokidar.watch(watchPaths, {
      cwd,
      ignored: ignores,
      depth,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: debounceMs,
        pollInterval: Math.min(100, debounceMs)
      }
    });

    const pending: FileSystemEvent[] = [];
    let timer: NodeJS.Timeout | undefined;

    const flush = () => {
      if (!pending.length) return;
      for (const event of pending.splice(0, pending.length)) {
        try {
          handler(event);
        } catch (error) {
          this.logger.error('File watcher handler error', { error });
        }
      }
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const queueEvent = (event: FileSystemEvent) => {
      if (debounceMs <= 0) {
        handler(event);
        return;
      }
      pending.push(event);
      if (!timer) {
        timer = setTimeout(flush, debounceMs);
      }
    };

    const mapEvent = (type: FileSystemEventType, filePath: string, stats?: Stats) => {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      return {
        type,
        path: absolutePath,
        relativePath: path.relative(cwd, absolutePath),
        stats
      } satisfies FileSystemEvent;
    };

    watcher
      .on('add', (filePath: string, stats?: Stats) => queueEvent(mapEvent('create', filePath, stats)))
      .on('change', (filePath: string, stats?: Stats) => queueEvent(mapEvent('change', filePath, stats)))
      .on('unlink', (filePath: string) => queueEvent(mapEvent('delete', filePath)))
      .on('addDir', (dirPath: string) => queueEvent(mapEvent('directory', dirPath)))
      .on('unlinkDir', (dirPath: string) => queueEvent(mapEvent('directory', dirPath)))
      .on('error', (error: Error) => this.logger.error('File watcher error', { error }));

    const active: ActiveWatcher = { watcher, flush };
    this.activeWatchers.add(active);

    return {
      close: async () => {
        this.activeWatchers.delete(active);
        flush();
        await watcher.close();
      }
    };
  }

  async dispose(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.activeWatchers, async ({ watcher, flush }) => {
        flush();
        await watcher.close();
      })
    );
    this.activeWatchers.clear();
  }
}
