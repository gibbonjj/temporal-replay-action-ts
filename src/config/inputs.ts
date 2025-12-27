import * as core from '@actions/core'
import * as fs from 'fs/promises'
import { ActionConfig } from './types'

export async function parseInputs(): Promise<ActionConfig> {
  // Read connection inputs
  const temporalAddress = core.getInput('temporal-address')
  const temporalNamespace = core.getInput('temporal-namespace')

  // TLS configuration - support both inline and file-based
  let tlsCert = core.getInput('temporal-tls-cert')
  let tlsKey = core.getInput('temporal-tls-key')

  const tlsCertPath = core.getInput('temporal-tls-cert-path')
  const tlsKeyPath = core.getInput('temporal-tls-key-path')

  // Read from files if paths provided and inline values not set
  if (!tlsCert && tlsCertPath) {
    core.debug(`Reading TLS certificate from file: ${tlsCertPath}`)
    tlsCert = await fs.readFile(tlsCertPath, 'utf-8')
  }

  if (!tlsKey && tlsKeyPath) {
    core.debug(`Reading TLS key from file: ${tlsKeyPath}`)
    tlsKey = await fs.readFile(tlsKeyPath, 'utf-8')
  }

  // Mask sensitive values
  if (tlsCert) {
    core.setSecret(tlsCert)
  }
  if (tlsKey) {
    core.setSecret(tlsKey)
  }

  // Workflow selection - validate mutually exclusive options
  const historyPath = core.getInput('workflow-history-path')
  const workflowIds = core.getInput('workflow-ids')
  const taskQueue = core.getInput('workflow-task-queue')
  const query = core.getInput('workflow-query')

  // Validate workflow selection
  const selectionMethods = [historyPath, workflowIds, taskQueue, query].filter(Boolean)
  if (selectionMethods.length === 0) {
    throw new Error(
      'Must specify at least one workflow selection method: workflow-history-path, workflow-ids, workflow-task-queue, or workflow-query'
    )
  }
  if (selectionMethods.length > 1) {
    core.warning(
      'Multiple selection methods provided. Priority: history-path > workflow-ids > task-queue > query'
    )
  }

  // Required inputs
  const workflowsPath = core.getInput('workflows-path', { required: true })

  // Parse max-histories with validation
  const maxHistoriesInput = core.getInput('max-histories')
  const maxHistories = parseInt(maxHistoriesInput) || 100
  if (maxHistories < 1) {
    throw new Error('max-histories must be at least 1')
  }
  if (maxHistories > 10000) {
    core.warning('max-histories is very large. This may take a long time.')
  }

  return {
    temporal: {
      address: temporalAddress,
      namespace: temporalNamespace,
      tls: tlsCert && tlsKey ? { cert: tlsCert, key: tlsKey } : null,
      serverRootCACert: core.getInput('temporal-server-root-ca-cert') || null,
      serverNameOverride: core.getInput('temporal-server-name-override') || null
    },
    selection: {
      historyPath,
      workflowIds: workflowIds ? workflowIds.split(',').map((id) => id.trim()) : [],
      taskQueue,
      query,
      maxHistories
    },
    build: {
      workflowsPath,
      buildCommand: core.getInput('build-command'),
      skipBuild: core.getInput('skip-build') === 'true',
      workingDirectory: core.getInput('working-directory') || '.'
    },
    output: {
      failOnReplayError: core.getInput('fail-on-replay-error') !== 'false',
      createJobSummary: core.getInput('create-job-summary') !== 'false'
    }
  }
}
