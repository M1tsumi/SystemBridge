import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createLogger, type Logger } from '../../core/logging.js';
import { execCommand } from '../../utils/exec.js';

export interface CpuTimes {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

export interface CpuInfo {
  model: string;
  speedMHz: number;
  times: CpuTimes;
}

export interface MemoryInfo {
  total: number;
  free: number;
  used: number;
  utilization: number;
}

export interface BatteryInfo {
  percentage?: number;
  charging?: boolean;
  remainingMinutes?: number;
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: string;
  mac: string;
  internal: boolean;
}

export interface SystemSnapshot {
  platform: NodeJS.Platform;
  release: string;
  hostname: string;
  uptimeSeconds: number;
  loadAverage: number[];
  cpus: CpuInfo[];
  memory: MemoryInfo;
  battery?: BatteryInfo;
  network: NetworkInterfaceInfo[];
}

interface SystemInfoModuleOptions {
  logger?: Logger;
  cacheMs?: number;
}

export class SystemInfoModule {
  private readonly logger;
  private readonly cacheMs: number;
  private cachedSnapshot?: { expiresAt: number; data: SystemSnapshot };

  constructor(options: SystemInfoModuleOptions = {}) {
    this.logger = createLogger(options.logger);
    this.cacheMs = options.cacheMs ?? 2000;
  }

  async snapshot(force = false): Promise<SystemSnapshot> {
    if (!force && this.cachedSnapshot && Date.now() < this.cachedSnapshot.expiresAt) {
      return this.cachedSnapshot.data;
    }

    const snapshot: SystemSnapshot = {
      platform: process.platform,
      release: os.release(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
      loadAverage: os.loadavg(),
      cpus: this.getCpuInfo(),
      memory: this.getMemoryInfo(),
      battery: await this.getBatteryInfo(),
      network: this.getNetworkInterfaces()
    };

    this.cachedSnapshot = {
      data: snapshot,
      expiresAt: Date.now() + this.cacheMs
    };

    return snapshot;
  }

  private getCpuInfo(): CpuInfo[] {
    return os.cpus().map((cpu) => ({
      model: cpu.model,
      speedMHz: cpu.speed,
      times: cpu.times
    }));
  }

  private getMemoryInfo(): MemoryInfo {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      total,
      free,
      used,
      utilization: Number((used / total).toFixed(4))
    };
  }

  private getNetworkInterfaces(): NetworkInterfaceInfo[] {
    const interfaces = os.networkInterfaces();
    const result: NetworkInterfaceInfo[] = [];
    for (const [name, entries] of Object.entries(interfaces)) {
      if (!entries) continue;
      for (const entry of entries) {
        if (!entry.address) continue;
        result.push({
          name,
          address: entry.address,
          family: entry.family,
          mac: entry.mac,
          internal: entry.internal
        });
      }
    }
    return result;
  }

  private async getBatteryInfo(): Promise<BatteryInfo | undefined> {
    try {
      if (process.platform === 'win32') {
        const result = await execCommand('powershell', [
          '-NoProfile',
          '-Command',
          'Get-WmiObject Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json'
        ]);
        if (!result.stdout.trim()) return undefined;
        const parsed = JSON.parse(result.stdout);
        const battery = Array.isArray(parsed) ? parsed[0] : parsed;
        return {
          percentage: battery?.EstimatedChargeRemaining,
          charging: battery?.BatteryStatus === 2
        };
      }

      if (process.platform === 'darwin') {
        const result = await execCommand('pmset', ['-g', 'batt']);
        const match = result.stdout.match(/(\d+)%.*?(discharging|charging|charged)/i);
        if (!match) return undefined;
        const [, percentage, status] = match;
        if (!status) return undefined;
        return {
          percentage: Number(percentage),
          charging: status.toLowerCase() !== 'discharging'
        };
      }

      if (process.platform === 'linux') {
        const batteryDir = '/sys/class/power_supply';
        const entries = await fs.readdir(batteryDir);
        const candidate = entries.find((entry) => entry.startsWith('BAT'));
        if (!candidate) return undefined;
        const capacityPath = path.join(batteryDir, candidate, 'capacity');
        const statusPath = path.join(batteryDir, candidate, 'status');
        const [capacityRaw, statusRaw] = await Promise.all([
          fs.readFile(capacityPath, 'utf8'),
          fs.readFile(statusPath, 'utf8')
        ]);
        return {
          percentage: Number(capacityRaw.trim()),
          charging: statusRaw.trim().toLowerCase() !== 'discharging'
        };
      }
    } catch (error) {
      this.logger.debug('Battery information unavailable', { error });
    }

    return undefined;
  }

  dispose(): void {
    this.cachedSnapshot = undefined;
  }
}
