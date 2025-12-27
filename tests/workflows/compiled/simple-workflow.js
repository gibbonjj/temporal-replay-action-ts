"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simpleWorkflow = simpleWorkflow;
exports.workflowWithActivities = workflowWithActivities;
// Simple workflow for testing replay functionality
async function simpleWorkflow(name) {
    return `Hello, ${name}!`;
}
// Workflow with activities for more complex testing
async function workflowWithActivities(name) {
    // This is a deterministic workflow that can be replayed
    const greeting = `Hello, ${name}!`;
    return greeting;
}
