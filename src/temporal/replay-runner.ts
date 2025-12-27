import { Worker } from '@temporalio/worker'
import { ActionConfig, ReplayResults, ReplayResult } from '../config/types'
import * as core from '@actions/core'
import * as path from 'path'

export async function runReplayTests(
  config: ActionConfig,
  histories: any[]
): Promise<ReplayResults> {
  core.info(`Running replay tests for ${histories.length} workflow histories`)

  const workflowsPath = path.resolve(config.build.workingDirectory, config.build.workflowsPath)

  core.info(`Using workflows from: ${workflowsPath}`)

  const results: ReplayResult[] = []
  let determinismViolations = 0
  let otherErrors = 0

  // Run replays individually to capture detailed results
  for (let i = 0; i < histories.length; i++) {
    const history = histories[i]
    const workflowId = extractWorkflowId(history)

    core.info(`Replaying workflow ${i + 1}/${histories.length}: ${workflowId}`)

    try {
      await Worker.runReplayHistory(
        {
          workflowsPath,
          replayName: workflowId
        },
        history
      )

      results.push({
        workflowId,
        success: true,
        error: null
      })

      core.info(`✓ Replay successful: ${workflowId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      const isDeterminismViolation =
        error instanceof Error && error.name === 'DeterminismViolationError'

      if (isDeterminismViolation) {
        determinismViolations++
        core.error(`✗ Determinism violation in ${workflowId}: ${errorMessage}`)
      } else {
        otherErrors++
        core.error(`✗ Replay error in ${workflowId}: ${errorMessage}`)
      }

      results.push({
        workflowId,
        success: false,
        error: {
          type: isDeterminismViolation ? 'DeterminismViolation' : 'ReplayError',
          message: errorMessage,
          stack: errorStack
        }
      })
    }
  }

  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  core.info(`
Replay Results Summary:
  Total: ${results.length}
  Successful: ${successful}
  Failed: ${failed}
  Determinism Violations: ${determinismViolations}
  Other Errors: ${otherErrors}
  `)

  return {
    total: results.length,
    successful,
    failed,
    determinismViolations,
    results
  }
}

function extractWorkflowId(history: any): string {
  // Extract workflow ID from history
  // The history object structure varies, but typically has workflowId in events
  try {
    if ('workflowId' in history && typeof history.workflowId === 'string') {
      return history.workflowId
    }

    // Try to extract from events
    if ('events' in history && Array.isArray(history.events) && history.events.length > 0) {
      const firstEvent = history.events[0]
      if (
        firstEvent &&
        'workflowExecutionStartedEventAttributes' in firstEvent &&
        firstEvent.workflowExecutionStartedEventAttributes
      ) {
        const attrs = firstEvent.workflowExecutionStartedEventAttributes as any
        if (attrs.workflowId) {
          return attrs.workflowId
        }
      }
    }
  } catch (error) {
    core.debug(`Failed to extract workflow ID: ${error}`)
  }

  return 'unknown'
}
