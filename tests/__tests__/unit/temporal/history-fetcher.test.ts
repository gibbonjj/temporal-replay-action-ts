import { Client } from '@temporalio/client'
import { glob } from 'glob'
import * as fs from 'fs/promises'
import * as core from '@actions/core'
import { fetchHistories } from '../../../../src/temporal/history-fetcher'
import { ActionConfig } from '../../../../src/config/types'

jest.mock('@temporalio/client')
jest.mock('glob')
jest.mock('fs/promises')
jest.mock('@actions/core')

describe('fetchHistories', () => {
  const mockConfig: ActionConfig = {
    temporal: {
      address: 'localhost:7233',
      namespace: 'default',
      tls: null,
      serverRootCACert: null,
      serverNameOverride: null
    },
    selection: {
      historyPath: '',
      workflowIds: [],
      taskQueue: '',
      query: '',
      maxHistories: 100
    },
    build: {
      workflowsPath: 'lib/workflows',
      buildCommand: '',
      skipBuild: false,
      workingDirectory: '.'
    },
    output: {
      failOnReplayError: true,
      createJobSummary: true
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fetch from files', () => {
    it('should fetch histories from JSON files', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, historyPath: 'histories/*.json' }
      }

      const mockGlob = glob as jest.MockedFunction<typeof glob>
      mockGlob.mockResolvedValue([
        '/path/to/history1.json',
        '/path/to/history2.json'
      ] as any)

      const mockReadFile = fs.readFile as jest.Mock
      mockReadFile.mockImplementation((path: string) => {
        if (path === '/path/to/history1.json') {
          return Promise.resolve(JSON.stringify({ workflowId: 'wf-1', events: [] }))
        }
        if (path === '/path/to/history2.json') {
          return Promise.resolve(JSON.stringify({ workflowId: 'wf-2', events: [] }))
        }
        return Promise.reject(new Error('File not found'))
      })

      const histories = await fetchHistories(config, null)

      expect(histories).toHaveLength(2)
      expect(histories[0]).toEqual({ workflowId: 'wf-1', events: [] })
      expect(histories[1]).toEqual({ workflowId: 'wf-2', events: [] })
    })

    it('should handle missing files gracefully', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, historyPath: 'histories/*.json' }
      }

      const mockGlob = glob as jest.MockedFunction<typeof glob>
      mockGlob.mockResolvedValue(['/path/to/invalid.json'] as any)

      const mockReadFile = fs.readFile as jest.Mock
      mockReadFile.mockRejectedValue(new Error('File not found'))

      const mockWarning = core.warning as jest.Mock

      const histories = await fetchHistories(config, null)

      expect(histories).toHaveLength(0)
      expect(mockWarning).toHaveBeenCalled()
    })

    it('should apply max-histories limit to files', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, historyPath: 'histories/*.json', maxHistories: 2 }
      }

      const mockGlob = glob as jest.MockedFunction<typeof glob>
      mockGlob.mockResolvedValue([
        '/path/to/history1.json',
        '/path/to/history2.json',
        '/path/to/history3.json'
      ] as any)

      const mockReadFile = fs.readFile as jest.Mock
      mockReadFile.mockResolvedValue(JSON.stringify({ workflowId: 'wf-1', events: [] }))

      const histories = await fetchHistories(config, null)

      expect(histories).toHaveLength(2)
    })

    it('should return empty array when no files found', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, historyPath: 'histories/*.json' }
      }

      const mockGlob = glob as jest.MockedFunction<typeof glob>
      mockGlob.mockResolvedValue([] as any)

      const histories = await fetchHistories(config, null)

      expect(histories).toHaveLength(0)
    })
  })

  describe('fetch by workflow IDs', () => {
    it('should fetch histories by workflow IDs', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, workflowIds: ['wf-1', 'wf-2'] }
      }

      const mockClient = {
        workflow: {
          getHandle: jest.fn().mockImplementation((id: string) => ({
            fetchHistory: jest.fn().mockResolvedValue({ workflowId: id, events: [] })
          }))
        }
      } as unknown as Client

      const histories = await fetchHistories(config, mockClient)

      expect(histories).toHaveLength(2)
      expect(mockClient.workflow.getHandle).toHaveBeenCalledWith('wf-1')
      expect(mockClient.workflow.getHandle).toHaveBeenCalledWith('wf-2')
    })

    it('should handle fetch errors gracefully', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, workflowIds: ['wf-1', 'wf-2'] }
      }

      const mockClient = {
        workflow: {
          getHandle: jest.fn().mockImplementation((id: string) => ({
            fetchHistory: jest.fn().mockImplementation(() => {
              if (id === 'wf-1') {
                return Promise.resolve({ workflowId: id, events: [] })
              }
              return Promise.reject(new Error('Workflow not found'))
            })
          }))
        }
      } as unknown as Client

      const mockWarning = core.warning as jest.Mock

      const histories = await fetchHistories(config, mockClient)

      expect(histories).toHaveLength(1)
      expect(mockWarning).toHaveBeenCalled()
    })

    it('should apply max-histories limit to workflow IDs', async () => {
      const config = {
        ...mockConfig,
        selection: {
          ...mockConfig.selection,
          workflowIds: ['wf-1', 'wf-2', 'wf-3'],
          maxHistories: 2
        }
      }

      const mockClient = {
        workflow: {
          getHandle: jest.fn().mockImplementation((id: string) => ({
            fetchHistory: jest.fn().mockResolvedValue({ workflowId: id, events: [] })
          }))
        }
      } as unknown as Client

      const histories = await fetchHistories(config, mockClient)

      expect(histories).toHaveLength(2)
      expect(mockClient.workflow.getHandle).toHaveBeenCalledTimes(2)
    })
  })

  describe('fetch by task queue', () => {
    it('should fetch histories by task queue', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, taskQueue: 'test-queue' }
      }

      const mockHistories = [
        { workflowId: 'wf-1', events: [] },
        { workflowId: 'wf-2', events: [] }
      ]

      const mockClient = {
        workflow: {
          list: jest.fn().mockReturnValue({
            intoHistories: jest.fn().mockReturnValue(
              (async function* () {
                for (const history of mockHistories) {
                  yield history
                }
              })()
            )
          })
        }
      } as unknown as Client

      const histories = await fetchHistories(config, mockClient)

      expect(histories).toHaveLength(2)
      expect(mockClient.workflow.list).toHaveBeenCalledWith({
        query: 'TaskQueue="test-queue"'
      })
    })
  })

  describe('fetch by custom query', () => {
    it('should fetch histories by custom query', async () => {
      const config = {
        ...mockConfig,
        selection: {
          ...mockConfig.selection,
          query: 'WorkflowType="MyWorkflow" AND StartTime > "2025-01-01"'
        }
      }

      const mockHistories = [{ workflowId: 'wf-1', events: [] }]

      const mockClient = {
        workflow: {
          list: jest.fn().mockReturnValue({
            intoHistories: jest.fn().mockReturnValue(
              (async function* () {
                for (const history of mockHistories) {
                  yield history
                }
              })()
            )
          })
        }
      } as unknown as Client

      const histories = await fetchHistories(config, mockClient)

      expect(histories).toHaveLength(1)
      expect(mockClient.workflow.list).toHaveBeenCalledWith({
        query: 'WorkflowType="MyWorkflow" AND StartTime > "2025-01-01"'
      })
    })

    it('should apply max-histories limit to query results', async () => {
      const config = {
        ...mockConfig,
        selection: {
          ...mockConfig.selection,
          query: 'WorkflowType="MyWorkflow"',
          maxHistories: 2
        }
      }

      const mockHistories = [
        { workflowId: 'wf-1', events: [] },
        { workflowId: 'wf-2', events: [] },
        { workflowId: 'wf-3', events: [] }
      ]

      const mockClient = {
        workflow: {
          list: jest.fn().mockReturnValue({
            intoHistories: jest.fn().mockReturnValue(
              (async function* () {
                for (const history of mockHistories) {
                  yield history
                }
              })()
            )
          })
        }
      } as unknown as Client

      const histories = await fetchHistories(config, mockClient)

      expect(histories).toHaveLength(2)
    })

    it('should handle query errors', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, query: 'INVALID_QUERY' }
      }

      const mockClient = {
        workflow: {
          list: jest.fn().mockImplementation(() => {
            throw new Error('Invalid query syntax')
          })
        }
      } as unknown as Client

      await expect(fetchHistories(config, mockClient)).rejects.toThrow(
        'Failed to fetch workflow histories'
      )
    })
  })

  describe('error handling', () => {
    it('should throw error when no selection method provided', async () => {
      const config = { ...mockConfig }
      const mockClient = {} as Client

      await expect(fetchHistories(config, mockClient)).rejects.toThrow(
        'No valid workflow selection method provided'
      )
    })

    it('should throw error when client is null for server-based fetching', async () => {
      const config = {
        ...mockConfig,
        selection: { ...mockConfig.selection, workflowIds: ['wf-1'] }
      }

      await expect(fetchHistories(config, null)).rejects.toThrow(
        'Temporal client required for server-based history fetching'
      )
    })
  })
})
