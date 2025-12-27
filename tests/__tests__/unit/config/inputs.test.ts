import * as core from '@actions/core'
import * as fs from 'fs/promises'
import { parseInputs } from '../../../../src/config/inputs'

jest.mock('@actions/core')
jest.mock('fs/promises')

describe('parseInputs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('valid inputs', () => {
    it('should parse all valid inputs correctly', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'temporal-address': 'localhost:7233',
          'temporal-namespace': 'default',
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'my-queue',
          'max-histories': '100'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.temporal.address).toBe('localhost:7233')
      expect(config.temporal.namespace).toBe('default')
      expect(config.build.workflowsPath).toBe('lib/workflows')
      expect(config.selection.taskQueue).toBe('my-queue')
      expect(config.selection.maxHistories).toBe(100)
    })

    it('should apply defaults for missing optional inputs', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.temporal.address).toBe('')
      expect(config.temporal.namespace).toBe('')
      expect(config.build.workingDirectory).toBe('.')
      expect(config.selection.maxHistories).toBe(100)
      expect(config.output.failOnReplayError).toBe(true)
      expect(config.output.createJobSummary).toBe(true)
    })

    it('should parse comma-separated workflow IDs', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-ids': 'workflow-1, workflow-2, workflow-3'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.selection.workflowIds).toEqual(['workflow-1', 'workflow-2', 'workflow-3'])
    })

    it('should parse max-histories as integer', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'max-histories': '50'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.selection.maxHistories).toBe(50)
    })
  })

  describe('TLS certificate handling', () => {
    it('should read TLS certificates from inline values', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'temporal-tls-cert': 'CERT_CONTENT',
          'temporal-tls-key': 'KEY_CONTENT'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.temporal.tls).toEqual({
        cert: 'CERT_CONTENT',
        key: 'KEY_CONTENT'
      })
    })

    it('should read TLS certificates from files', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'temporal-tls-cert-path': '/path/to/cert.pem',
          'temporal-tls-key-path': '/path/to/key.pem'
        }
        return inputs[name] || ''
      })

      const mockReadFile = fs.readFile as jest.Mock
      mockReadFile.mockImplementation((path: string) => {
        if (path === '/path/to/cert.pem') return Promise.resolve('FILE_CERT_CONTENT')
        if (path === '/path/to/key.pem') return Promise.resolve('FILE_KEY_CONTENT')
        return Promise.reject(new Error('File not found'))
      })

      const config = await parseInputs()

      expect(config.temporal.tls).toEqual({
        cert: 'FILE_CERT_CONTENT',
        key: 'FILE_KEY_CONTENT'
      })
    })

    it('should mask sensitive TLS values', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'temporal-tls-cert': 'SECRET_CERT',
          'temporal-tls-key': 'SECRET_KEY'
        }
        return inputs[name] || ''
      })

      const mockSetSecret = core.setSecret as jest.Mock

      await parseInputs()

      expect(mockSetSecret).toHaveBeenCalledWith('SECRET_CERT')
      expect(mockSetSecret).toHaveBeenCalledWith('SECRET_KEY')
    })

    it('should return null TLS when no certificates provided', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.temporal.tls).toBeNull()
    })
  })

  describe('workflow selection validation', () => {
    it('should throw error when no selection method provided', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows'
        }
        return inputs[name] || ''
      })

      await expect(parseInputs()).rejects.toThrow(
        'Must specify at least one workflow selection method'
      )
    })

    it('should warn when multiple selection methods provided', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'workflow-ids': 'id-1,id-2'
        }
        return inputs[name] || ''
      })

      const mockWarning = core.warning as jest.Mock

      await parseInputs()

      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining('Multiple selection methods provided')
      )
    })
  })

  describe('required inputs', () => {
    it('should require workflows-path', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string, options?: any) => {
        if (name === 'workflows-path' && options?.required) {
          throw new Error('Input required and not supplied: workflows-path')
        }
        // Also need a selection method to pass that validation
        if (name === 'workflow-task-queue') {
          return 'test-queue'
        }
        return ''
      })

      await expect(parseInputs()).rejects.toThrow('Input required and not supplied: workflows-path')
    })
  })

  describe('max-histories validation', () => {
    it('should default to 100 when max-histories is invalid', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'max-histories': 'invalid'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.selection.maxHistories).toBe(100)
    })

    it('should warn when max-histories is very large', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'max-histories': '15000'
        }
        return inputs[name] || ''
      })

      const mockWarning = core.warning as jest.Mock

      await parseInputs()

      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining('max-histories is very large')
      )
    })
  })

  describe('boolean inputs', () => {
    it('should parse skip-build as boolean', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'skip-build': 'true'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.build.skipBuild).toBe(true)
    })

    it('should parse fail-on-replay-error as boolean', async () => {
      const mockGetInput = core.getInput as jest.Mock
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'workflows-path': 'lib/workflows',
          'workflow-task-queue': 'test-queue',
          'fail-on-replay-error': 'false'
        }
        return inputs[name] || ''
      })

      const config = await parseInputs()

      expect(config.output.failOnReplayError).toBe(false)
    })
  })
})
