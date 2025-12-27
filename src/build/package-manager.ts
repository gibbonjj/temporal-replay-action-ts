import * as fs from 'fs/promises'
import * as path from 'path'
import * as core from '@actions/core'
import { PackageManager } from '../config/types'

export async function detectPackageManager(workingDirectory: string): Promise<PackageManager> {
  const lockFiles: Array<[string, PackageManager]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm']
  ]

  for (const [lockFile, manager] of lockFiles) {
    try {
      const lockPath = path.join(workingDirectory, lockFile)
      await fs.access(lockPath)
      core.info(`Detected package manager: ${manager} (found ${lockFile})`)
      return manager
    } catch {
      // Lock file doesn't exist, continue
    }
  }

  core.info('No lock file found, defaulting to npm')
  return 'npm'
}

export function getInstallCommand(pm: PackageManager): string {
  const commands: Record<PackageManager, string> = {
    npm: 'npm ci',
    yarn: 'yarn install --frozen-lockfile',
    pnpm: 'pnpm install --frozen-lockfile',
    bun: 'bun install --frozen-lockfile'
  }
  return commands[pm]
}

export function getBuildCommand(pm: PackageManager): string {
  const commands: Record<PackageManager, string> = {
    npm: 'npm run build',
    yarn: 'yarn build',
    pnpm: 'pnpm build',
    bun: 'bun run build'
  }
  return commands[pm]
}
