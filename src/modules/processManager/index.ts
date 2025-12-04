import { spawn, type ChildProcess, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { once } from 'node:events';
import psList, { type ProcessDescriptor } from 'ps-list';
import pidusage from 'pidusage';
import { createLogger, type Logger } from '../../core/logging.js';
import { SystemBridgeError } from '../../core/errors.js';

interface PidUsageStat {
  cpu: number;
  memory: number;
  ppid: number;
  pid: number;
  ctime: number;
  elapsed: number;
  timestamp: number;
}

export interface ProcessFilter {
  pid?: number;
  nameIncludes?: string;
  user?: string;
  binaryPathIncludes?: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd?: string;
  ppid?: number;
  cpuPercent?: number;
  memoryBytes?: number;
  binaryPath?: string;
  user?: string;
}

export interface ProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface LaunchProcessOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  detached?: boolean;
  abortSignal?: AbortSignal;
  stdio?: SpawnOptionsWithoutStdio['stdio'];
}

export interface ManagedProcess {
  pid: number;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  stdin: NodeJS.WritableStream | null;
  wait(): Promise<ProcessExit>;
  kill(signal?: NodeJS.Signals | number): void;
}

export interface KillProcessResult {
  success: boolean;
  signal?: NodeJS.Signals | number;
}

interface ProcessManagerOptions {
  logger?: Logger;
}

export class ProcessManager {
  private readonly logger;
  private readonly managed = new Set<ChildProcess>();

  constructor(options: ProcessManagerOptions = {}) {
    this.logger = createLogger(options.logger);
  }

  async listProcesses(filter?: ProcessFilter): Promise<ProcessInfo[]> {
    const processes = await psList();
    const normalized: ProcessInfo[] = processes.map((proc: ProcessDescriptor & { username?: string; uid?: number }) => ({
      pid: proc.pid,
      name: proc.name,
      cmd: proc.cmd,
      ppid: proc.ppid,
      cpuPercent: proc.cpu,
      memoryBytes: proc.memory,
      binaryPath: proc.cmd,
      user: proc.username ?? proc.uid?.toString()
    }));

    if (!filter) return normalized;

    return normalized.filter((proc: ProcessInfo) => {
      if (filter.pid && proc.pid !== filter.pid) return false;
      if (filter.nameIncludes && !proc.name.toLowerCase().includes(filter.nameIncludes.toLowerCase())) {
        return false;
      }
      if (filter.user && proc.user !== filter.user) return false;
      if (filter.binaryPathIncludes) {
        const cmd = `${proc.cmd ?? ''}`.toLowerCase();
        if (!cmd.includes(filter.binaryPathIncludes.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }

  async getResourceUsage(pid: number): Promise<PidUsageStat> {
    try {
      return (await pidusage(pid)) as PidUsageStat;
    } catch (error) {
      this.logger.warn('Failed to get resource usage', { pid, error });
      throw new SystemBridgeError(`Unable to get usage for pid ${pid}`, 'OPERATION_FAILED', error);
    }
  }

  launchProcess(options: LaunchProcessOptions): ManagedProcess {
    const { command, args = [], cwd, env, detached = false, abortSignal, stdio = 'pipe' } = options;
    const child = spawn(command, args, { cwd, env, detached, stdio });

    const abort = () => {
      this.logger.warn('Aborting managed process', { command, pid: child.pid });
      child.kill('SIGTERM');
    };

    if (abortSignal) {
      if (abortSignal.aborted) {
        abort();
      } else {
        abortSignal.addEventListener('abort', abort, { once: true });
      }
    }

    this.managed.add(child);
    child.once('exit', () => {
      this.managed.delete(child);
      abortSignal?.removeEventListener('abort', abort);
    });

    return {
      pid: child.pid ?? -1,
      stdout: child.stdout,
      stderr: child.stderr,
      stdin: child.stdin,
      wait: async (): Promise<ProcessExit> => {
        const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
        return { code, signal };
      },
      kill: (signal?: NodeJS.Signals | number) => {
        child.kill(signal);
      }
    };
  }

  async killProcess(pid: number, signal: NodeJS.Signals | number = 'SIGTERM'): Promise<KillProcessResult> {
    try {
      const success = process.kill(pid, signal as NodeJS.Signals)
        ? true
        : false;
      return { success, signal };
    } catch (error) {
      this.logger.error('Failed to kill process', { pid, error });
      throw new SystemBridgeError(`Unable to kill pid ${pid}`, 'OPERATION_FAILED', error);
    }
  }

  async dispose(): Promise<void> {
    for (const child of this.managed) {
      try {
        if (child.exitCode === null) {
          child.kill('SIGTERM');
        }
      } catch (error) {
        this.logger.warn('Failed to dispose process', { pid: child.pid, error });
      }
    }
    this.managed.clear();
  }
}
