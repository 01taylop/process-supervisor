// ==================================================
// Public Types
// ==================================================

/**
 * Represents the lifecycle state of a managed resource
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
 * Configuration for a managed resource
 */
interface ManagedResourceConfig<T = unknown> {
  /**
   * Function to start the resource
   * Returns the running resource instance
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
}

// ==================================================
// Internal Types
// ==================================================

/**
 * Internal representation of a managed resource
 * @internal
 */
interface ManagedResource<T = unknown> {
  config: Required<ManagedResourceConfig<T>>
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
  ManagedResourceConfig,
  ProcessSupervisorOptions,
}

export {
  ProcessState,
}
