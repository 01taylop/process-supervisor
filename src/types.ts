// ==================================================
// Public Types
// ==================================================

/**
 * Represents the lifecycle state of a resource
 */
enum ProcessState {
  /** Resource encountered an error */
  FAILED = 'failed',
  /** Resource has not been started */
  IDLE = 'idle',
  /** Resource is running normally */
  RUNNING = 'running',
  /** Resource is in the process of starting */
  STARTING = 'starting',
  /** Resource has stopped cleanly */
  STOPPED = 'stopped',
  /** Resource is in the process of stopping */
  STOPPING = 'stopping',
}

/**
 * Configuration for a resource
 */
interface ResourceConfig<T = unknown> {
  /**
   * Function to start the resource
   *
   * IMPORTANT: Must be a function that creates the resource when called.
   * Do NOT execute the resource before passing it in.
   *
   * ✅ Correct: start: () => spawn('cmd')
   * ❌ Wrong:   start: spawn('cmd')
   *
   * @returns The running resource instance
   */
  start: () => T | Promise<T>

  /**
   * Function to stop the resource
   * Receives the running instance and cleans it up
   */
  stop: (instance: T) => void | Promise<void>

  /**
   * Maximum time in milliseconds to wait for stop() to complete
   * @default 5000
   */
  timeout?: number
}

/**
 * Options for creating a ProcessSupervisor
 */
interface ProcessSupervisorOptions {
  /**
   * Default timeout in milliseconds for stopping resources
   * @default 5000
   */
  defaultTimeout?: number

  /**
   * Handle process signals for graceful shutdown
   * - `true`: Handle SIGINT and SIGTERM
   * - `false`: Disable automatic signal handling
   * - Array: Handle specific signals (e.g., `['SIGINT', 'SIGTERM', 'SIGUSR2']`)
   * @default true
   */
  handleSignals?: boolean | NodeJS.Signals[]

  /**
   * Handle uncaught errors for graceful shutdown
   * Automatically calls shutdownAll() when uncaughtException or unhandledRejection occurs
   * @default true
   */
  handleUncaughtErrors?: boolean

  /**
   * Callback invoked before automatic shutdown when an uncaught error occurs
   * Use this to perform custom error handling like reporting to Sentry or logging
   * The supervisor will proceed with shutdownAll() after this callback completes
   *
   * If this callback throws an error, it will be logged but shutdown will continue normally
   *
   * @param error - The uncaught error or unhandled rejection
   */
  onError?: (error: unknown) => void | Promise<void>

  /**
   * Callback invoked before automatic shutdown when a signal is received
   * Use this to perform custom actions like logging or reporting to external services
   * The supervisor will proceed with shutdownAll() after this callback completes
   *
   * If this callback throws an error, it will be logged but shutdown will continue normally
   *
   * @param signal - The signal that triggered the shutdown (e.g., 'SIGINT', 'SIGTERM')
   */
  onSignal?: (signal: string) => void | Promise<void>
}

// ==================================================
// Internal Types
// ==================================================

/**
 * Internal representation of a managed resource
 * @internal
 */
interface ManagedResource<T = unknown> {
  config: Required<ResourceConfig<T>>
  error?: Error
  id: string
  instance: T | null
  state: ProcessState
}

// ==================================================
// Exports
// ==================================================

export type {
  ManagedResource,
  ProcessSupervisorOptions,
  ResourceConfig,
}

export {
  ProcessState,
}
