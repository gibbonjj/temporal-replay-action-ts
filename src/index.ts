import * as core from '@actions/core'
import { parseInputs } from './config/inputs'
import { buildWorkflows } from './build/builder'
import { createTemporalConnection } from './temporal/connection'
import { fetchHistories } from './temporal/history-fetcher'
import { runReplayTests } from './temporal/replay-runner'
import { generateJobSummary } from './reporting/summary'

async function run(): Promise<void> {
  try {
    core.info('Starting Temporal Replay Testing Action')

    // 1. Parse and validate inputs
    core.info('Parsing action inputs...')
    const config = await parseInputs()

    // 2. Build workflows (if needed)
    if (!config.build.skipBuild) {
      core.info('Building workflows...')
      await buildWorkflows(config)
    } else {
      core.info('Skipping build step')
    }

    // 3. Create Temporal connection (if needed)
    const client = await createTemporalConnection(config)

    // 4. Fetch workflow histories
    core.info('Fetching workflow histories...')
    const histories = await fetchHistories(config, client)

    if (histories.length === 0) {
      core.warning('No workflow histories found to replay')
      core.setOutput('total-replays', 0)
      core.setOutput('successful-replays', 0)
      core.setOutput('failed-replays', 0)
      core.setOutput('determinism-violations', 0)
      return
    }

    // 5. Run replay tests
    core.info('Running replay tests...')
    const results = await runReplayTests(config, histories)

    // 6. Generate job summary
    if (config.output.createJobSummary) {
      await generateJobSummary(results)
    }

    // 7. Set outputs
    core.setOutput('total-replays', results.total)
    core.setOutput('successful-replays', results.successful)
    core.setOutput('failed-replays', results.failed)
    core.setOutput('determinism-violations', results.determinismViolations)

    // 8. Fail if configured and errors occurred
    if (config.output.failOnReplayError && results.failed > 0) {
      core.setFailed(
        `Replay testing failed: ${results.failed} failure(s), ${results.determinismViolations} determinism violation(s)`
      )
    } else {
      core.info('Replay testing completed successfully')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    core.error(`Action failed: ${errorMessage}`)
    if (errorStack) {
      core.debug(errorStack)
    }

    core.setFailed(errorMessage)
  }
}

run()
