# 🛸 Process Supervisor

[![Test](https://github.com/01taylop/process-supervisor/actions/workflows/test.yml/badge.svg)](https://github.com/01taylop/process-supervisor/actions/workflows/test.yml)

![Node Versions Supported](https://img.shields.io/static/v1?label=node&message=>=18.18.0&color=blue)

A lightweight Node.js utility for managing the lifecycle of multiple resources with automatic graceful shutdown. Handles child processes, file watchers, servers, and more with zero dependencies.

- [Motivation](#motivation)
- [Example](#example)
  - [Common Use Cases](#common-use-cases)

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
