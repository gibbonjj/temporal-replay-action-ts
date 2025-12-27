import * as core from '@actions/core'
import { generateJobSummary } from '../../../../src/reporting/summary'
import { ReplayResults } from '../../../../src/config/types'

jest.mock('@actions/core')

describe('generateJobSummary', () => {
  let mockSummary: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock the summary object with chainable methods
    mockSummary = {
      addHeading: jest.fn().mockReturnThis(),
      addTable: jest.fn().mockReturnThis(),
      addRaw: jest.fn().mockReturnThis(),
      write: jest.fn().mockResolvedValue(undefined)
    }

    ;(core.summary as any) = mockSummary
  })

  describe('all successful replays', () => {
    it('should generate summary with all successful replays', async () => {
      const results: ReplayResults = {
        total: 5,
        successful: 5,
        failed: 0,
        determinismViolations: 0,
        results: [
          { workflowId: 'wf-1', success: true, error: null },
          { workflowId: 'wf-2', success: true, error: null },
          { workflowId: 'wf-3', success: true, error: null },
          { workflowId: 'wf-4', success: true, error: null },
          { workflowId: 'wf-5', success: true, error: null }
        ]
      }

      await generateJobSummary(results)

      expect(mockSummary.addHeading).toHaveBeenCalledWith('Temporal Replay Test Results', 2)
      expect(mockSummary.addTable).toHaveBeenCalled()
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('All replay tests passed successfully')
      )
      expect(mockSummary.write).toHaveBeenCalled()
    })

    it('should calculate 100% success rate for all successful', async () => {
      const results: ReplayResults = {
        total: 3,
        successful: 3,
        failed: 0,
        determinismViolations: 0,
        results: []
      }

      await generateJobSummary(results)

      const tableCall = mockSummary.addTable.mock.calls[0][0]
      const successRateRow = tableCall.find((row: any[]) => row[0] === 'Success Rate')
      expect(successRateRow[1]).toBe('100.0%')
    })
  })

  describe('failed replays', () => {
    it('should generate summary with failures', async () => {
      const results: ReplayResults = {
        total: 3,
        successful: 1,
        failed: 2,
        determinismViolations: 1,
        results: [
          { workflowId: 'wf-1', success: true, error: null },
          {
            workflowId: 'wf-2',
            success: false,
            error: {
              type: 'DeterminismViolation',
              message: 'Command mismatch',
              stack: 'Error stack'
            }
          },
          {
            workflowId: 'wf-3',
            success: false,
            error: {
              type: 'ReplayError',
              message: 'Workflow not found',
              stack: 'Error stack'
            }
          }
        ]
      }

      await generateJobSummary(results)

      expect(mockSummary.addHeading).toHaveBeenCalledWith('Failed Replays', 3)
      expect(mockSummary.addTable).toHaveBeenCalledTimes(2)
    })

    it('should include failed replays table with error details', async () => {
      const results: ReplayResults = {
        total: 2,
        successful: 0,
        failed: 2,
        determinismViolations: 1,
        results: [
          {
            workflowId: 'wf-1',
            success: false,
            error: {
              type: 'DeterminismViolation',
              message: 'Determinism error message',
              stack: 'stack trace'
            }
          },
          {
            workflowId: 'wf-2',
            success: false,
            error: {
              type: 'ReplayError',
              message: 'Replay error message',
              stack: 'stack trace'
            }
          }
        ]
      }

      await generateJobSummary(results)

      const failedTableCall = mockSummary.addTable.mock.calls[1][0]
      expect(failedTableCall).toEqual(
        expect.arrayContaining([
          [
            { data: 'Workflow ID', header: true },
            { data: 'Error Type', header: true },
            { data: 'Message', header: true }
          ],
          ['wf-1', 'DeterminismViolation', 'Determinism error message'],
          ['wf-2', 'ReplayError', 'Replay error message']
        ])
      )
    })

    it('should truncate long error messages', async () => {
      const longMessage = 'A'.repeat(150)
      const results: ReplayResults = {
        total: 1,
        successful: 0,
        failed: 1,
        determinismViolations: 0,
        results: [
          {
            workflowId: 'wf-1',
            success: false,
            error: {
              type: 'ReplayError',
              message: longMessage,
              stack: 'stack'
            }
          }
        ]
      }

      await generateJobSummary(results)

      const failedTableCall = mockSummary.addTable.mock.calls[1][0]
      const messageCell = failedTableCall[1][2]
      expect(messageCell.length).toBeLessThanOrEqual(103) // 100 chars + '...'
      expect(messageCell).toContain('...')
    })

    it('should handle missing error messages', async () => {
      const results: ReplayResults = {
        total: 1,
        successful: 0,
        failed: 1,
        determinismViolations: 0,
        results: [
          {
            workflowId: 'wf-1',
            success: false,
            error: {
              type: 'ReplayError',
              message: '',
              stack: 'stack'
            }
          }
        ]
      }

      await generateJobSummary(results)

      const failedTableCall = mockSummary.addTable.mock.calls[1][0]
      // Empty message is truncated to empty string, but summary displays it as-is
      expect(failedTableCall[1][2]).toBe('No error message')
    })
  })

  describe('success rate calculation', () => {
    it('should calculate correct success rate for partial success', async () => {
      const results: ReplayResults = {
        total: 10,
        successful: 7,
        failed: 3,
        determinismViolations: 2,
        results: []
      }

      await generateJobSummary(results)

      const tableCall = mockSummary.addTable.mock.calls[0][0]
      const successRateRow = tableCall.find((row: any[]) => row[0] === 'Success Rate')
      expect(successRateRow[1]).toBe('70.0%')
    })

    it('should handle 0% success rate', async () => {
      const results: ReplayResults = {
        total: 5,
        successful: 0,
        failed: 5,
        determinismViolations: 5,
        results: []
      }

      await generateJobSummary(results)

      const tableCall = mockSummary.addTable.mock.calls[0][0]
      const successRateRow = tableCall.find((row: any[]) => row[0] === 'Success Rate')
      expect(successRateRow[1]).toBe('0.0%')
    })

    it('should handle zero total replays', async () => {
      const results: ReplayResults = {
        total: 0,
        successful: 0,
        failed: 0,
        determinismViolations: 0,
        results: []
      }

      await generateJobSummary(results)

      const tableCall = mockSummary.addTable.mock.calls[0][0]
      const successRateRow = tableCall.find((row: any[]) => row[0] === 'Success Rate')
      expect(successRateRow[1]).toBe('0%')
    })
  })

  describe('summary table', () => {
    it('should include all metrics in summary table', async () => {
      const results: ReplayResults = {
        total: 10,
        successful: 7,
        failed: 3,
        determinismViolations: 2,
        results: []
      }

      await generateJobSummary(results)

      const tableCall = mockSummary.addTable.mock.calls[0][0]

      // Verify header row
      expect(tableCall[0]).toEqual([
        { data: 'Metric', header: true },
        { data: 'Count', header: true }
      ])

      // Verify data rows exist with correct values
      expect(tableCall).toContainEqual(['Total Workflows', '10'])
      expect(tableCall).toContainEqual(['✅ Successful', '7'])
      expect(tableCall).toContainEqual(['❌ Failed', '3'])
      expect(tableCall).toContainEqual(['⚠️ Determinism Violations', '2'])

      // Verify success rate row exists
      const successRateRow = tableCall.find((row: any[]) => row[0] === 'Success Rate')
      expect(successRateRow).toBeDefined()
      expect(successRateRow[1]).toBe('70.0%')
    })
  })

  describe('formatting', () => {
    it('should include footer with link to action', async () => {
      const results: ReplayResults = {
        total: 1,
        successful: 1,
        failed: 0,
        determinismViolations: 0,
        results: []
      }

      await generateJobSummary(results)

      expect(mockSummary.addRaw).toHaveBeenCalledWith('\n\n---\n\n')
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        expect.stringContaining('Temporal Replay Testing Action')
      )
    })

    it('should use emoji for visual clarity', async () => {
      const results: ReplayResults = {
        total: 3,
        successful: 1,
        failed: 2,
        determinismViolations: 1,
        results: []
      }

      await generateJobSummary(results)

      const tableCall = mockSummary.addTable.mock.calls[0][0]

      // Check that the table contains rows with emoji
      const hasSuccessEmoji = tableCall.some((row: any[]) =>
        typeof row[0] === 'string' && row[0].includes('✅') && row[0].includes('Successful')
      )
      const hasFailedEmoji = tableCall.some((row: any[]) =>
        typeof row[0] === 'string' && row[0].includes('❌') && row[0].includes('Failed')
      )
      const hasViolationsEmoji = tableCall.some((row: any[]) =>
        typeof row[0] === 'string' && row[0].includes('⚠️') && row[0].includes('Determinism')
      )

      expect(hasSuccessEmoji).toBe(true)
      expect(hasFailedEmoji).toBe(true)
      expect(hasViolationsEmoji).toBe(true)
    })
  })

  describe('logging', () => {
    it('should log when generating summary', async () => {
      const results: ReplayResults = {
        total: 1,
        successful: 1,
        failed: 0,
        determinismViolations: 0,
        results: []
      }

      const mockInfo = core.info as jest.Mock

      await generateJobSummary(results)

      expect(mockInfo).toHaveBeenCalledWith('Generating GitHub job summary')
      expect(mockInfo).toHaveBeenCalledWith('Job summary created')
    })
  })

  describe('error type handling', () => {
    it('should handle missing error type', async () => {
      const results: ReplayResults = {
        total: 1,
        successful: 0,
        failed: 1,
        determinismViolations: 0,
        results: [
          {
            workflowId: 'wf-1',
            success: false,
            error: null
          }
        ]
      }

      await generateJobSummary(results)

      const failedTableCall = mockSummary.addTable.mock.calls[1][0]
      expect(failedTableCall[1][1]).toBe('Unknown')
      expect(failedTableCall[1][2]).toBe('No error message')
    })
  })
})
