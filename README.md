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

**`register<T>(id: string, config: ManagedResourceConfig<T>): void`**

Register a new resource with the supervisor.

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
interface ManagedResourceConfig<T> {
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
