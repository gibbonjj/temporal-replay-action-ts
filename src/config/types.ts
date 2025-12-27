export interface ActionConfig {
  temporal: {
    address: string
    namespace: string
    tls: {
      cert: string
      key: string
    } | null
    serverRootCACert: string | null
    serverNameOverride: string | null
  }
  selection: {
    historyPath: string
    workflowIds: string[]
    taskQueue: string
    query: string
    maxHistories: number
  }
  build: {
    workflowsPath: string
    buildCommand: string
    skipBuild: boolean
    workingDirectory: string
  }
  output: {
    failOnReplayError: boolean
    createJobSummary: boolean
  }
}

export interface ReplayResult {
  workflowId: string
  success: boolean
  error: {
    type: 'DeterminismViolation' | 'ReplayError'
    message: string
    stack?: string
  } | null
}

export interface ReplayResults {
  total: number
  successful: number
  failed: number
  determinismViolations: number
  results: ReplayResult[]
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'
