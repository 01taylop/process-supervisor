# 🛸 Process Supervisor

[![Test](https://github.com/01taylop/process-supervisor/actions/workflows/test.yml/badge.svg)](https://github.com/01taylop/process-supervisor/actions/workflows/test.yml)

![Node Versions Supported](https://img.shields.io/static/v1?label=node&message=>=18.18.0&color=blue)

A lightweight Node.js utility for managing the lifecycle of multiple resources with automatic graceful shutdown. Handles child processes, file watchers, servers, and more with zero dependencies.

- [Motivation](#motivation)
- [Example](#example)
  - [Common Use Cases](#common-use-cases)
- [Usage](#usage)
  - [Installation](#installation)
  - [Importing](#importing)
  - [API](#api)
    - [Constructor Options](#constructor-options)
    - [Methods](#methods)
    - [Resource Configuration](#resource-configuration)
- [Advanced Usage](#advanced-usage)
  - [Manual Shutdown Control](#manual-shutdown-control)
  - [Custom Signal Handling](#custom-signal-handling)
  - [Custom Error Handling](#custom-error-handling)
  - [Accessing Resource Instances](#accessing-resource-instances)
  - [Changing Resource Configuration](#changing-resource-configuration)

## Motivation

Building Node.js applications often involves managing multiple resources like development servers, file watchers, and background processes. Each needs proper startup, shutdown, and error handling — especially when the application exits. Without proper cleanup, you're left with orphaned processes, file handles, and lingering connections.

Writing signal handlers, managing cleanup order, and handling edge cases quickly becomes complex boilerplate that's repeated across projects.

Process Supervisor eliminates this complexity by providing a simple API that automatically handles graceful shutdown on process signals (Ctrl+C, SIGTERM) and uncaught errors. Register your resources once, and the supervisor ensures they're properly cleaned up when your application exits — no more manual signal handlers or cleanup code.

## Example

```typescript
import { spawn } from 'node:child_process'

import { ProcessSupervisor } from 'process-supervisor'

const supervisor = new ProcessSupervisor()

supervisor.register('server', {
  start: () => spawn('tsx', ['watch', 'src/index.ts']),
  stop: proc => {
    proc.kill('SIGTERM')
    return new Promise(resolve => proc.on('exit', resolve))
  }
})

await supervisor.start('server')

// That's it! The supervisor automatically:
// - Shuts down on Ctrl+C (SIGINT)
// - Shuts down on SIGTERM
// - Shuts down on uncaught errors (uncaughtException and unhandledRejection)
// - Enforces timeout (5s default)
// - Exits with proper code (0 = success, 1 = error)
```

### Common Use Cases

**Child Processes** (e.g., execa, spawn)

```typescript
supervisor.register('dev-server', {
  start: () => spawn('tsx', ['watch', 'src/index.ts']),
  stop: proc => {
    proc.kill('SIGTERM')
    return new Promise(resolve => proc.on('exit', resolve))
  }
})
```

**File Watchers** (e.g., chokidar)

```typescript
import chokidar from 'chokidar'

supervisor.register('watcher', {
  start: () => chokidar.watch('src/**/*.ts'),
  stop: async watcher => await watcher.close(),
})
```

**Servers** (e.g., Webpack DevServer)

```typescript
import { WebpackDevServer } from 'webpack-dev-server'

supervisor.register('webpack', {
  start: async () => {
    const server = new WebpackDevServer(options, compiler)
    await server.start()
    return server
  },
  stop: async server => await server.stop()
})
```

## Usage

### Installation

Install the package as a dependency:

```bash
# Using npm
npm install process-supervisor

# Using yarn
yarn add process-supervisor
```

### Importing

You can import `ProcessSupervisor` using either CommonJS or ES Modules:

```js
// Using CommonJS
const { ProcessSupervisor } = require('process-supervisor')

// Using ES Modules
import { ProcessSupervisor } from 'process-supervisor'
```

### API

#### Constructor Options

```typescript
new ProcessSupervisor(options?)
```

| Property               | Type                        | Required | Default | Description                                                                                     |
|------------------------|---------------------------- |----------|---------|-------------------------------------------------------------------------------------------------|
| `defaultTimeout`       | number                      | -        | `5000`  | Default timeout in milliseconds for stopping resources.                                         |
| `handleSignals`        | boolean \| NodeJS.Signals[] | -        | `true`  | Automatically handle process signals. Pass `true` for SIGINT/SIGTERM, array for custom signals. |
| `handleUncaughtErrors` | boolean                     | -        | `true`  | Automatically handle uncaught exceptions and unhandled promise rejections.                      |

#### Methods

**`register<T>(id: string, config: ResourceConfig<T>): void`**

Register a new resource with the supervisor.

**`unregister(id: string): Promise<void>`**

Unregister a resource from the supervisor. Automatically stops the resource if it is running.

**`getInstance<T>(id: string): T | null`**

Get the instance of a resource. Returns `null` if the resource has never been started.

**`start(id: string): Promise<void>`**

Start a resource.

**`stop(id: string): Promise<void>`**

Stop a running resource. Enforces timeout configured on the resource.

**`shutdownAll(): Promise<boolean>`**

Stop all resources in parallel. Returns `true` if any errors occurred.

**`getState(id: string): ProcessState | undefined`**

Get the current state of a resource. States: `IDLE`, `STARTING`, `RUNNING`, `STOPPING`, `STOPPED`, `FAILED`.

**`getAllStates(): ReadonlyMap<string, ProcessState>`**

Get the current state of all resources.

**`has(id: string): boolean`**

Check if a resource is registered.

**`size: number`**

Get the total number of registered resources.

#### Resource Configuration

```typescript
interface ResourceConfig<T> {
  start: () => T | Promise<T>
  stop: (instance: T) => void | Promise<void>
  timeout?: number
}
```

| Property  | Type                                    | Required | Description                                                                              |
|-----------|-----------------------------------------|----------|------------------------------------------------------------------------------------------|
| `start`   | () => T \| Promise\<T>                  | ✅       | Function that creates and returns the resource instance.                                 |
| `stop`    | (instance: T) => void \| Promise\<void> | ✅       | Function that cleans up the resource. Receives the running instance.                     |
| `timeout` | number                                  | -        | Maximum time in milliseconds to wait for stop to complete. Defaults to `defaultTimeout`. |

**Important:** The `start` function must return a function that creates the resource, not the resource itself:

```typescript
// ✅ Correct
start: () => spawn('command')

// ❌ Wrong
start: spawn('command')
```

## Advanced Usage

### Manual Shutdown Control

By default, the supervisor handles shutdown automatically. But you can also trigger shutdown manually:

```typescript
// Stop a specific resource
await supervisor.stop('server')

// Stop all resources
await supervisor.shutdownAll()
```

This is useful when you need shutdown logic in custom signal handlers or specific error scenarios.

### Custom Signal Handling

Disable automatic signal handling when you need custom behaviour:

```typescript
const supervisor = new ProcessSupervisor({
  handleSignals: false  // Disable automatic SIGINT/SIGTERM handling
})

// Now you control signal behaviour
process.on('SIGINT', async () => {
  console.log('Gracefully shutting down...')
  await supervisor.shutdownAll()
  process.exit(0)
})
```

Or handle specific signals only:

```typescript
const supervisor = new ProcessSupervisor({
  handleSignals: ['SIGTERM']  // Only handle SIGTERM, not SIGINT
})
```

### Custom Error Handling

Disable automatic error handling when you need custom crash behaviour:

```typescript
const supervisor = new ProcessSupervisor({
  handleUncaughtErrors: false  // Disable automatic error handling
})

// Now you control error behaviour
process.on('uncaughtException', async error => {
  console.error('Unexpected error:', error)
  await reportToSentry(error)
  await supervisor.shutdownAll()
  process.exit(1)
})

process.on('unhandledRejection', async error => {
  console.error('Unhandled promise:', error)
  await reportToSentry(error)
  await supervisor.shutdownAll()
  process.exit(1)
})
```

### Accessing Resource Instances

Use `getInstance` to access the underlying resource for advanced control:

```typescript
// Force-kill a process after timeout
try {
  await supervisor.stop('server')
} catch (error) {
  const proc = supervisor.getInstance<ChildProcess>('server')
  proc?.kill('SIGKILL')
}
```

### Changing Resource Configuration

To change a resource's configuration, unregister and re-register it:

```typescript
await supervisor.unregister('server')
supervisor.register('server', newConfig)
await supervisor.start('server')
```
