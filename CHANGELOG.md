# process-supervisor

## 1.0.1

### Patch Changes

- 398771b: Fixed TypeScript types for CommonJS consumers and for ESM consumers using `node16` module resolution
- 398771b: Marked the package as side-effect free so bundlers can tree-shake it

## 1.0.0

### Major Changes

- 2bbc93f: Initial stable release with core process lifecycle management

  Features:

  - Register and manage multiple resources (child processes, file watchers, servers, etc.)
  - Automatic graceful shutdown on process signals (`SIGINT`, `SIGTERM`)
  - Automatic shutdown on uncaught errors (`uncaughtException`, `unhandledRejection`)
  - Configurable timeouts with `Promise.race` enforcement
  - Parallel resource shutdown with individual error handling
  - State tracking for all resources (`IDLE`, `STARTING`, `RUNNING`, `STOPPING`, `STOPPED`, `FAILED`)
  - Exit codes reflect shutdown success (0 = success, 1 = errors)
  - Double-shutdown prevention safeguard
  - Zero dependencies
  - 100% test coverage (unit + integration)
  - Full TypeScript support with strict types

  Breaking changes:

  - Initial release, no breaking changes
