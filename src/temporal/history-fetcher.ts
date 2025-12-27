import { Client } from '@temporalio/client'
import { ActionConfig } from '../config/types'
import { glob } from 'glob'
import * as fs from 'fs/promises'
import * as core from '@actions/core'
import * as path from 'path'

export async function fetchHistories(config: ActionConfig, client: Client | null): Promise<any[]> {
  const selection = config.selection

  // Priority 1: Pre-exported history files
  if (selection.historyPath) {
    return await fetchFromFiles(selection.historyPath, selection.maxHistories)
  }

  // For server-based fetching, client is required
  if (!client) {
    throw new Error('Temporal client required for server-based history fetching')
  }

  // Priority 2: Specific workflow IDs
  if (selection.workflowIds.length > 0) {
    return await fetchByIds(client, selection.workflowIds, selection.maxHistories)
  }

  // Priority 3: Task queue
  if (selection.taskQueue) {
    return await fetchByTaskQueue(client, selection.taskQueue, selection.maxHistories)
  }

  // Priority 4: Custom query
  if (selection.query) {
    return await fetchByQuery(client, selection.query, selection.maxHistories)
  }

  throw new Error('No valid workflow selection method provided')
}

async function fetchFromFiles(pattern: string, maxHistories: number): Promise<any[]> {
  core.info(`Searching for history files: ${pattern}`)

  const files = await glob(pattern, {
    absolute: true,
    nodir: true
  })

  core.info(`Found ${files.length} history file(s)`)

  if (files.length === 0) {
    core.warning(`No history files found matching pattern: ${pattern}`)
    return []
  }

  const limitedFiles = files.slice(0, maxHistories)
  if (files.length > maxHistories) {
    core.warning(`Limiting to first ${maxHistories} files (out of ${files.length} found)`)
  }

  const histories: any[] = []

  for (const file of limitedFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8')
      const history = JSON.parse(content)
      histories.push(history)
      core.debug(`Loaded history from ${path.basename(file)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      core.warning(`Failed to load history from ${file}: ${errorMessage}`)
    }
  }

  core.info(`Successfully loaded ${histories.length} workflow histories from files`)
  return histories
}

async function fetchByIds(
  client: Client,
  workflowIds: string[],
  maxHistories: number
): Promise<any[]> {
  core.info(`Fetching histories for ${workflowIds.length} workflow ID(s)`)

  const limitedIds = workflowIds.slice(0, maxHistories)
  if (workflowIds.length > maxHistories) {
    core.warning(
      `Limiting to first ${maxHistories} workflow IDs (out of ${workflowIds.length} provided)`
    )
  }

  const histories: any[] = []

  for (const workflowId of limitedIds) {
    try {
      const handle = client.workflow.getHandle(workflowId)
      const history = await handle.fetchHistory()
      histories.push(history)
      core.debug(`Fetched history for workflow ID: ${workflowId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      core.warning(`Failed to fetch history for ${workflowId}: ${errorMessage}`)
    }
  }

  core.info(`Successfully fetched ${histories.length} workflow histories`)
  return histories
}

async function fetchByTaskQueue(
  client: Client,
  taskQueue: string,
  maxHistories: number
): Promise<any[]> {
  core.info(`Fetching histories from task queue: ${taskQueue}`)

  const query = `TaskQueue="${taskQueue}"`
  return await fetchByQuery(client, query, maxHistories)
}

async function fetchByQuery(client: Client, query: string, maxHistories: number): Promise<any[]> {
  core.info(`Fetching histories with query: ${query}`)

  try {
    const workflows = client.workflow.list({ query })
    const historiesIterator = workflows.intoHistories()

    const histories: any[] = []
    let count = 0

    for await (const history of historiesIterator) {
      if (count >= maxHistories) {
        core.warning(`Reached max histories limit of ${maxHistories}`)
        break
      }
      histories.push(history)
      count++
      core.debug(`Fetched history ${count}/${maxHistories}`)
    }

    core.info(`Successfully fetched ${histories.length} workflow histories`)
    return histories
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    core.error(`Failed to fetch histories: ${errorMessage}`)
    throw new Error(`Failed to fetch workflow histories: ${errorMessage}`)
  }
}
