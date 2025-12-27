import { Connection, Client } from '@temporalio/client'
import { ActionConfig } from '../config/types'
import * as core from '@actions/core'

export async function createTemporalConnection(
  config: ActionConfig
): Promise<Client | null> {
  // If only using history files, no connection needed
  if (config.selection.historyPath) {
    core.info('Using pre-exported history files - skipping Temporal connection')
    return null
  }

  core.info(`Connecting to Temporal at ${config.temporal.address}`)

  const connectionOptions: any = {
    address: config.temporal.address
  }

  // Configure TLS if provided
  if (config.temporal.tls) {
    core.info('Configuring mTLS authentication')
    connectionOptions.tls = {
      clientCertPair: {
        crt: Buffer.from(config.temporal.tls.cert),
        key: Buffer.from(config.temporal.tls.key)
      }
    }

    if (config.temporal.serverRootCACert) {
      core.debug('Using custom server root CA certificate')
      connectionOptions.tls.serverRootCACertificate = Buffer.from(
        config.temporal.serverRootCACert
      )
    }

    if (config.temporal.serverNameOverride) {
      core.debug(`Using server name override: ${config.temporal.serverNameOverride}`)
      connectionOptions.tls.serverNameOverride = config.temporal.serverNameOverride
    }
  }

  try {
    const connection = await Connection.connect(connectionOptions)

    const client = new Client({
      connection,
      namespace: config.temporal.namespace
    })

    core.info(`Successfully connected to Temporal namespace: ${config.temporal.namespace}`)
    return client
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to connect to Temporal: ${errorMessage}`)
  }
}
