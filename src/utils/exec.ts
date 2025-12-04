import { spawn } from 'node:child_process';
import { once } from 'node:events';

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  input?: string | Buffer;
  encoding?: BufferEncoding;
  abortSignal?: AbortSignal;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
}

export async function execCommand(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
  const { cwd, env, timeoutMs = 0, input, encoding = 'utf8', abortSignal } = options;

  const child = spawn(command, args, {
    cwd,
    env,
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    signal: abortSignal
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  if (input && child.stdin) {
    child.stdin.write(input);
    child.stdin.end();
  }

  let timeout: NodeJS.Timeout | undefined;
  if (timeoutMs > 0) {
    timeout = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeoutMs);
  }

  try {
    const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
    return {
      code,
      signal,
      stdout: Buffer.concat(stdoutChunks).toString(encoding),
      stderr: Buffer.concat(stderrChunks).toString(encoding)
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
