# Temporal Replay Testing Action

A GitHub Action for testing Temporal TypeScript workflows for determinism using replay testing. This action helps you catch non-deterministic code changes before they cause issues in production.

## Features

- **Multiple workflow selection methods**: Test workflows from files, specific IDs, task queues, or custom queries
- **Automatic build detection**: Auto-detects and builds your workflows using npm, yarn, pnpm, or bun
- **Cloud & local support**: Works with both Temporal Cloud (mTLS) and self-hosted Temporal servers
- **Comprehensive reporting**: GitHub job summary with detailed results and error information
- **Flexible configuration**: Extensive customization options for all aspects of replay testing

## Quick Start

### Basic Usage - Local Temporal Server

```yaml
name: Temporal Replay Tests
on: [push, pull_request]

jobs:
  replay-test:
    runs-on: ubuntu-latest

    services:
      temporal:
        image: temporalio/auto-setup:latest
        ports:
          - 7233:7233

    steps:
      - uses: actions/checkout@v4

      - name: Run Replay Tests
        uses: jamesgibbons/temporal-replay-action-ts@v1
        with:
          workflows-path: 'lib/workflows'
          workflow-task-queue: 'my-task-queue'
```

### Temporal Cloud with mTLS

```yaml
- name: Run Replay Tests on Temporal Cloud
  uses: jamesgibbons/temporal-replay-action-ts@v1
  with:
    workflows-path: 'dist/workflows'
    workflow-query: 'WorkflowType="MyWorkflow" AND StartTime > "2024-01-01"'
    temporal-address: 'my-namespace.tmprl.cloud:7233'
    temporal-namespace: 'my-namespace'
    temporal-tls-cert: ${{ secrets.TEMPORAL_TLS_CERT }}
    temporal-tls-key: ${{ secrets.TEMPORAL_TLS_KEY }}
    max-histories: 50
```

## Inputs

### Connection Configuration

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `temporal-address` | Temporal server address (e.g., `localhost:7233` or `namespace.tmprl.cloud:7233`) | No | `localhost:7233` |
| `temporal-namespace` | Temporal namespace | No | `default` |
| `temporal-tls-cert` | TLS client certificate (PEM format) for mTLS authentication | No | - |
| `temporal-tls-key` | TLS client private key (PEM format) for mTLS authentication | No | - |
| `temporal-tls-cert-path` | Path to TLS client certificate file | No | - |
| `temporal-tls-key-path` | Path to TLS client private key file | No | - |
| `temporal-server-root-ca-cert` | Optional server root CA certificate for TLS verification | No | - |
| `temporal-server-name-override` | Optional server name override for TLS SNI | No | - |

### Workflow Selection

**Note**: If multiple selection methods are provided, priority order is: `workflow-history-path` > `workflow-ids` > `workflow-task-queue` > `workflow-query`

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `workflow-history-path` | Path to pre-exported workflow history JSON file(s). Supports glob patterns (e.g., `histories/*.json`) | No | - |
| `workflow-ids` | Comma-separated list of specific workflow IDs to replay | No | - |
| `workflow-task-queue` | Task queue to fetch workflow histories from | No | - |
| `workflow-query` | Custom list query for selecting workflows (e.g., `"WorkflowType=MyWorkflow AND StartTime > 2024-01-01"`) | No | - |
| `max-histories` | Maximum number of workflow histories to replay (safety limit) | No | `100` |

### Build Configuration

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `workflows-path` | Path to compiled workflows code (relative to repo root) | **Yes** | - |
| `build-command` | Custom build command (overrides auto-detection) | No | - |
| `skip-build` | Skip the build step (use pre-built code) | No | `false` |
| `working-directory` | Working directory for build and workflow execution | No | `.` |

### Output Configuration

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `fail-on-replay-error` | Fail the action if any replay errors occur | No | `true` |
| `create-job-summary` | Create GitHub job summary with results | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `total-replays` | Total number of workflow histories replayed |
| `successful-replays` | Number of successful replays |
| `failed-replays` | Number of failed replays |
| `determinism-violations` | Number of determinism violations detected |

## Usage Examples

### 1. Test with Pre-exported History Files

Great for regression testing and offline validation:

```yaml
- name: Run Replay Tests from Files
  uses: jamesgibbons/temporal-replay-action-ts@v1
  with:
    workflows-path: 'build/workflows'
    workflow-history-path: 'test/histories/*.json'
```

### 2. Test Specific Workflow IDs

Useful for targeted testing:

```yaml
- name: Run Replay Tests for Specific Workflows
  uses: jamesgibbons/temporal-replay-action-ts@v1
  with:
    workflows-path: 'lib/workflows'
    workflow-ids: 'workflow-123,workflow-456,workflow-789'
    temporal-address: 'localhost:7233'
```

### 3. Custom Build Command

When you need custom build logic:

```yaml
- name: Run Replay Tests with Custom Build
  uses: jamesgibbons/temporal-replay-action-ts@v1
  with:
    workflows-path: 'lib/workflows'
    workflow-task-queue: 'production-queue'
    build-command: 'pnpm build:workflows'
    working-directory: './packages/workflows'
```

### 4. Skip Build for Pre-built Code

If you build in a separate step:

```yaml
- name: Build Workflows
  run: npm run build

- name: Run Replay Tests
  uses: jamesgibbons/temporal-replay-action-ts@v1
  with:
    workflows-path: 'dist/workflows'
    workflow-task-queue: 'my-queue'
    skip-build: true
```

### 5. Advanced Query with Temporal Cloud

Test workflows matching complex criteria:

```yaml
- name: Run Replay Tests with Advanced Query
  uses: jamesgibbons/temporal-replay-action-ts@v1
  with:
    workflows-path: 'lib/workflows'
    workflow-query: 'WorkflowType="OrderProcessing" AND ExecutionStatus="Running" AND StartTime > "2025-01-01T00:00:00"'
    temporal-address: 'prod.tmprl.cloud:7233'
    temporal-namespace: 'production'
    temporal-tls-cert: ${{ secrets.TEMPORAL_TLS_CERT }}
    temporal-tls-key: ${{ secrets.TEMPORAL_TLS_KEY }}
    max-histories: 200
```

## How It Works

1. **Parse Configuration**: Reads and validates all action inputs
2. **Build Workflows**: Auto-detects package manager (npm/yarn/pnpm/bun) and builds your workflow code
3. **Fetch Histories**: Retrieves workflow histories based on your selection method
4. **Run Replays**: Executes `Worker.runReplayHistory()` for each workflow history
5. **Report Results**: Generates GitHub job summary with detailed results
6. **Fail if Needed**: Fails the action if determinism violations or errors are detected

## Understanding Replay Testing

Replay testing validates that your workflow code changes are compatible with existing workflow executions. During replay:

- The Worker runs your workflow code against recorded event histories
- If the code produces different commands than the original execution, a `DeterminismViolationError` is thrown
- This catches non-deterministic changes before they affect running workflows in production

### Common Causes of Non-Determinism

1. **Random values**: Using `Math.random()`, `Date.now()`, etc. in workflow code
2. **External state**: Reading from databases, files, or APIs directly in workflows
3. **Code changes**: Modifying workflow logic while executions are running
4. **Dependency changes**: Updating libraries that affect workflow behavior

### Best Practices

- Run replay tests in CI/CD before deploying workflow changes
- Test against a representative sample of workflow histories
- Use Temporal's versioning/patching features for non-backward-compatible changes
- Export and commit critical workflow histories for regression testing

## Security Considerations

### TLS Certificates

- Store certificates and keys as GitHub Secrets
- Use either inline values (from secrets) or file paths
- Certificates are automatically masked in logs

Example:

```yaml
env:
  TEMPORAL_TLS_CERT: ${{ secrets.TEMPORAL_TLS_CERT }}
  TEMPORAL_TLS_KEY: ${{ secrets.TEMPORAL_TLS_KEY }}

steps:
  - uses: jamesgibbons/temporal-replay-action-ts@v1
    with:
      temporal-tls-cert: ${{ env.TEMPORAL_TLS_CERT }}
      temporal-tls-key: ${{ env.TEMPORAL_TLS_KEY }}
```

## Troubleshooting

### Build Failures

If auto-detection fails:
- Specify `build-command` explicitly
- Or set `skip-build: true` and build in a separate step

### Connection Errors

- Verify `temporal-address` is correct
- Check that Temporal server is accessible from GitHub Actions
- For cloud: ensure TLS certificates are valid and not expired

### No Histories Found

- Verify your selection criteria (task queue, query, etc.)
- Check that workflows exist in the specified namespace
- Ensure Advanced Visibility is enabled (required for server-side replay)

### Workflow Path Errors

- `workflows-path` must point to **compiled JavaScript**, not TypeScript
- Path is relative to `working-directory`
- Verify the path exists after the build step

## Requirements

- Node.js 20+ (automatically provided by GitHub Actions)
- Temporal TypeScript SDK v1.x in your project
- For server-based replay: Temporal Server 1.18+ with Advanced Visibility enabled

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Links

- [Temporal Documentation](https://docs.temporal.io/)
- [Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript)
- [Replay Testing Guide](https://docs.temporal.io/develop/typescript/testing-suite)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Support

If you encounter issues or have questions:
- Open an issue on [GitHub](https://github.com/jamesgibbons/temporal-replay-action-ts/issues)
- Check the [Temporal community forum](https://community.temporal.io/)
- Review the [troubleshooting section](#troubleshooting)
