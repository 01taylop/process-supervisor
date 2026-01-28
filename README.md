# 🛸 Process Supervisor

[![Test](https://github.com/01taylop/process-supervisor/actions/workflows/test.yml/badge.svg)](https://github.com/01taylop/process-supervisor/actions/workflows/test.yml)

![Node Versions Supported](https://img.shields.io/static/v1?label=node&message=>=18.18.0&color=blue)

Automatic graceful shutdown for Node.js applications. Manage child processes, file watchers, and servers with zero boilerplate and zero dependencies.

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
  - [Lifecycle Hooks](#lifecycle-hooks)
  - [Custom Error Handling](#custom-error-handling)
  - [Custom Signal Handling](#custom-signal-handling)
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
  },
})

await supervisor.start('server')

// That's it! Automatic graceful shutdown on:
// - Ctrl+C (SIGINT) and SIGTERM
// - Uncaught errors (uncaughtException, unhandledRejection)
// Plus: 5s timeout enforcement and proper exit codes
```

### Common Use Cases

**Child Processes** (e.g., execa, spawn)

```typescript
supervisor.register('dev-server', {
  start: () => spawn('tsx', ['watch', 'src/index.ts']),
  stop: proc => {
    proc.kill('SIGTERM')
    return new Promise(resolve => proc.on('exit', resolve))
  },
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
  stop: async server => await server.stop(),
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

| Property               | Type                                       | Required | Default | Description                                                                                     |
|------------------------|--------------------------------------------|----------|---------|-------------------------------------------------------------------------------------------------|
| `defaultTimeout`       | number                                     | -        | `5000`  | Default timeout in milliseconds for stopping resources.                                         |
| `handleSignals`        | boolean \| NodeJS.Signals[]                | -        | `true`  | Automatically handle process signals. Pass `true` for SIGINT/SIGTERM, array for custom signals. |
| `handleUncaughtErrors` | boolean                                    | -        | `true`  | Automatically handle uncaught exceptions and unhandled promise rejections.                      |
| `onError`              | (error: unknown) => void \| Promise\<void> | -        | -       | Callback invoked before automatic shutdown when an uncaught error occurs.                       |
| `onSignal`             | (signal: string) => void \| Promise\<void> | -        | -       | Callback invoked before automatic shutdown when a signal is received.                           |

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

By default, the supervisor handles shutdown automatically. You can also trigger shutdown manually:

```typescript
// Stop a specific resource
await supervisor.stop('server')

// Stop all resources
await supervisor.shutdownAll()
```

This is useful when you need shutdown logic in custom signal handlers or specific error scenarios.

### Lifecycle Hooks

Lifecycle hooks let you run custom logic before automatic shutdown.

**Note:** Hooks require automatic handlers to be enabled: `onError` requires `handleUncaughtErrors` to be enabled, and `onSignal` requires `handleSignals` to be enabled. For full control over shutdown behaviour, see [Custom Error Handling](#custom-error-handling) and [Custom Signal Handling](#custom-signal-handling).

```typescript
const supervisor = new ProcessSupervisor({
  onError: async error => {
    await reportToSentry(error)
  },
  onSignal: async signal => {
    await reportToSentry({ event: 'shutdown', signal })
  },
})
```

The hooks are called before `shutdownAll()` runs, allowing you to:

- Report shutdown events to monitoring services (Sentry, Datadog, etc.)
- Log shutdown reasons to files or external services
- Send metrics or analytics
- Perform custom cleanup that doesn't fit the resource model

**Error handling:** If a hook throws an error, it will be logged but won't prevent shutdown. This ensures your application always cleans up resources properly, even if custom logic fails.

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

### Custom Signal Handling

Disable automatic signal handling when you need custom behaviour:

```typescript
const supervisor = new ProcessSupervisor({
  handleSignals: false,  // Disable automatic SIGINT/SIGTERM handling
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
  handleSignals: ['SIGTERM'],  // Only handle SIGTERM, not SIGINT
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
