import { proxyActivities } from '@temporalio/workflow'

// Simple workflow for testing replay functionality
export async function simpleWorkflow(name: string): Promise<string> {
  return `Hello, ${name}!`
}

// Workflow with activities for more complex testing
export async function workflowWithActivities(name: string): Promise<string> {
  // This is a deterministic workflow that can be replayed
  const greeting = `Hello, ${name}!`
  return greeting
}
