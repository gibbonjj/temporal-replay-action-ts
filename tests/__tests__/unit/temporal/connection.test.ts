import { Connection, Client } from '@temporalio/client'
import * as core from '@actions/core'
import { createTemporalConnection } from '../../../../src/temporal/connection'
import { ActionConfig } from '../../../../src/config/types'

jest.mock('@temporalio/client')
jest.mock('@actions/core')

describe('createTemporalConnection', () => {
  const baseConfig: ActionConfig = {
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

  describe('history file mode', () => {
    it('should return null when using history files only', async () => {
      const config = {
        ...baseConfig,
        selection: { ...baseConfig.selection, historyPath: 'histories/*.json' }
      }

      const client = await createTemporalConnection(config)

      expect(client).toBeNull()
      expect(Connection.connect).not.toHaveBeenCalled()
    })
  })

  describe('local server connection', () => {
    it('should connect without TLS for local server', async () => {
      const config = {
        ...baseConfig,
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      const mockConnection = {}
      const mockClient = {}

      ;(Connection.connect as jest.Mock).mockResolvedValue(mockConnection)
      ;(Client as unknown as jest.Mock).mockImplementation(() => mockClient)

      const client = await createTemporalConnection(config)

      expect(Connection.connect).toHaveBeenCalledWith({
        address: 'localhost:7233'
      })
      expect(Client).toHaveBeenCalledWith({
        connection: mockConnection,
        namespace: 'default'
      })
      expect(client).toBe(mockClient)
    })
  })

  describe('TLS/mTLS configuration', () => {
    it('should connect with TLS for cloud', async () => {
      const config = {
        ...baseConfig,
        temporal: {
          ...baseConfig.temporal,
          address: 'namespace.tmprl.cloud:7233',
          tls: {
            cert: 'CERT_CONTENT',
            key: 'KEY_CONTENT'
          }
        },
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      const mockConnection = {}
      const mockClient = {}

      ;(Connection.connect as jest.Mock).mockResolvedValue(mockConnection)
      ;(Client as unknown as jest.Mock).mockImplementation(() => mockClient)

      const client = await createTemporalConnection(config)

      expect(Connection.connect).toHaveBeenCalledWith({
        address: 'namespace.tmprl.cloud:7233',
        tls: {
          clientCertPair: {
            crt: Buffer.from('CERT_CONTENT'),
            key: Buffer.from('KEY_CONTENT')
          }
        }
      })
      expect(client).toBe(mockClient)
    })

    it('should configure mTLS certificates correctly', async () => {
      const config = {
        ...baseConfig,
        temporal: {
          ...baseConfig.temporal,
          tls: {
            cert: 'MY_CERT',
            key: 'MY_KEY'
          }
        },
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      const mockConnection = {}
      const mockClient = {}

      ;(Connection.connect as jest.Mock).mockResolvedValue(mockConnection)
      ;(Client as unknown as jest.Mock).mockImplementation(() => mockClient)

      await createTemporalConnection(config)

      const connectCall = (Connection.connect as jest.Mock).mock.calls[0][0]
      expect(connectCall.tls.clientCertPair.crt).toEqual(Buffer.from('MY_CERT'))
      expect(connectCall.tls.clientCertPair.key).toEqual(Buffer.from('MY_KEY'))
    })

    it('should apply server root CA if provided', async () => {
      const config = {
        ...baseConfig,
        temporal: {
          ...baseConfig.temporal,
          tls: {
            cert: 'CERT',
            key: 'KEY'
          },
          serverRootCACert: 'ROOT_CA_CERT'
        },
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      const mockConnection = {}
      const mockClient = {}

      ;(Connection.connect as jest.Mock).mockResolvedValue(mockConnection)
      ;(Client as unknown as jest.Mock).mockImplementation(() => mockClient)

      await createTemporalConnection(config)

      const connectCall = (Connection.connect as jest.Mock).mock.calls[0][0]
      expect(connectCall.tls.serverRootCACertificate).toEqual(Buffer.from('ROOT_CA_CERT'))
    })

    it('should apply server name override if provided', async () => {
      const config = {
        ...baseConfig,
        temporal: {
          ...baseConfig.temporal,
          tls: {
            cert: 'CERT',
            key: 'KEY'
          },
          serverNameOverride: 'custom.server.name'
        },
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      const mockConnection = {}
      const mockClient = {}

      ;(Connection.connect as jest.Mock).mockResolvedValue(mockConnection)
      ;(Client as unknown as jest.Mock).mockImplementation(() => mockClient)

      await createTemporalConnection(config)

      const connectCall = (Connection.connect as jest.Mock).mock.calls[0][0]
      expect(connectCall.tls.serverNameOverride).toBe('custom.server.name')
    })

    it('should not include TLS config when certificates not provided', async () => {
      const config = {
        ...baseConfig,
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      const mockConnection = {}
      const mockClient = {}

      ;(Connection.connect as jest.Mock).mockResolvedValue(mockConnection)
      ;(Client as unknown as jest.Mock).mockImplementation(() => mockClient)

      await createTemporalConnection(config)

      const connectCall = (Connection.connect as jest.Mock).mock.calls[0][0]
      expect(connectCall.tls).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should throw error on connection failure', async () => {
      const config = {
        ...baseConfig,
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      ;(Connection.connect as jest.Mock).mockRejectedValue(
        new Error('Connection refused')
      )

      await expect(createTemporalConnection(config)).rejects.toThrow(
        'Failed to connect to Temporal: Connection refused'
      )
    })

    it('should handle non-Error exceptions', async () => {
      const config = {
        ...baseConfig,
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      ;(Connection.connect as jest.Mock).mockRejectedValue('String error')

      await expect(createTemporalConnection(config)).rejects.toThrow(
        'Failed to connect to Temporal: String error'
      )
    })
  })

  describe('logging', () => {
    it('should log connection info', async () => {
      const config = {
        ...baseConfig,
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      const mockConnection = {}
      const mockClient = {}

      ;(Connection.connect as jest.Mock).mockResolvedValue(mockConnection)
      ;(Client as unknown as jest.Mock).mockImplementation(() => mockClient)

      const mockInfo = core.info as jest.Mock

      await createTemporalConnection(config)

      expect(mockInfo).toHaveBeenCalledWith(
        'Connecting to Temporal at localhost:7233'
      )
      expect(mockInfo).toHaveBeenCalledWith(
        'Successfully connected to Temporal namespace: default'
      )
    })

    it('should log mTLS configuration', async () => {
      const config = {
        ...baseConfig,
        temporal: {
          ...baseConfig.temporal,
          tls: {
            cert: 'CERT',
            key: 'KEY'
          }
        },
        selection: { ...baseConfig.selection, taskQueue: 'test-queue' }
      }

      const mockConnection = {}
      const mockClient = {}

      ;(Connection.connect as jest.Mock).mockResolvedValue(mockConnection)
      ;(Client as unknown as jest.Mock).mockImplementation(() => mockClient)

      const mockInfo = core.info as jest.Mock

      await createTemporalConnection(config)

      expect(mockInfo).toHaveBeenCalledWith('Configuring mTLS authentication')
    })

    it('should log when skipping connection for history files', async () => {
      const config = {
        ...baseConfig,
        selection: { ...baseConfig.selection, historyPath: 'histories/*.json' }
      }

      const mockInfo = core.info as jest.Mock

      await createTemporalConnection(config)

      expect(mockInfo).toHaveBeenCalledWith(
        'Using pre-exported history files - skipping Temporal connection'
      )
    })
  })
})
