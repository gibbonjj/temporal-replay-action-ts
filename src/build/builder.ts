import { execSync } from 'child_process'
import * as core from '@actions/core'
import { ActionConfig } from '../config/types'
import { detectPackageManager, getInstallCommand, getBuildCommand } from './package-manager'

export async function buildWorkflows(config: ActionConfig): Promise<void> {
  const workingDir = config.build.workingDirectory

  // Use custom command if provided
  if (config.build.buildCommand) {
    core.info(`Running custom build command: ${config.build.buildCommand}`)
    try {
      execSync(config.build.buildCommand, {
        cwd: workingDir,
        stdio: 'inherit',
        encoding: 'utf-8'
      })
      core.info('Custom build completed successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Custom build failed: ${errorMessage}`)
    }
    return
  }

  // Auto-detect and build
  const packageManager = await detectPackageManager(workingDir)

  try {
    core.info(`Installing dependencies with ${packageManager}...`)
    const installCmd = getInstallCommand(packageManager)
    execSync(installCmd, { cwd: workingDir, stdio: 'inherit', encoding: 'utf-8' })
    core.info('Dependencies installed successfully')

    core.info(`Building workflows with ${packageManager}...`)
    const buildCmd = getBuildCommand(packageManager)
    execSync(buildCmd, { cwd: workingDir, stdio: 'inherit', encoding: 'utf-8' })
    core.info('Build completed successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Build failed: ${errorMessage}`)
  }
}
