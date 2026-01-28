import { ProcessState } from './types'

import type {
  ManagedResource,
  ManagedResourceConfig,
  ProcessSupervisorOptions,
} from './types'

/**
 * Supervises the lifecycle of multiple managed resources
 * Provides centralised state tracking and coordinated shutdown
 */
class ProcessSupervisor {

  private readonly defaultTimeout: number
  private readonly options: ProcessSupervisorOptions

  private isShuttingDown = false
  private resources: Map<string, ManagedResource<any>> = new Map()

  constructor(options: ProcessSupervisorOptions = {}) {
    this.defaultTimeout = options.defaultTimeout ?? 5000
    this.options = options

    if (options.handleSignals !== false) {
      const signals: NodeJS.Signals[] = Array.isArray(options.handleSignals)
        ? options.handleSignals
        : ['SIGINT', 'SIGTERM']
      this.handleSignals(signals)
    }

    if (options.handleUncaughtErrors !== false) {
      this.handleUncaughtErrors()
    }
  }

  /**
   * Register a new managed resource with the supervisor
   *
   * @param id - Unique identifier for this resource
   * @param config - Configuration defining how to start and stop the resource
   * @throws Error if a resource with this id is already registered
   */
  register<T>(id: string, config: ManagedResourceConfig<T>): void {
    if (this.resources.has(id)) {
      throw new Error(`Resource with id "${id}" is already registered`)
    }

    const resource: ManagedResource<T> = {
      config: {
        ...config,
        timeout: config.timeout ?? this.defaultTimeout,
      },
      id,
      instance: null,
      state: ProcessState.IDLE,
    }

    this.resources.set(id, resource)
  }

  /**
   * Unregister a managed resource from the supervisor
   * Automatically stops the resource if it is running
   *
   * @param id - The resource identifier
   * @throws Error if the resource is not found
   */
  async unregister(id: string): Promise<void> {
    const resource = this.getResource(id)

    if (resource.state === ProcessState.RUNNING) {
      await this.stop(id)
    }

    this.resources.delete(id)
  }

  /**
   * Get the instance of a managed resource
   *
   * @param id - The resource identifier
   * @returns The resource instance, or null if the resource has never been started
   * @throws Error if the resource is not found
   */
  getInstance<T>(id: string): T | null {
    const resource = this.getResource(id)

    return (resource.instance as T) ?? null
  }

  /**
   * Get the current state of a managed resource
   *
   * @param id - The resource identifier
   * @returns The current ProcessState, or undefined if not found
   */
  getState(id: string): ProcessState | undefined {
    return this.resources.get(id)?.state
  }

  /**
   * Get the current state of all managed resources
   *
   * @returns A readonly map of resource ids to their current states
   */
  getAllStates(): ReadonlyMap<string, ProcessState> {
    const states = new Map<string, ProcessState>()
    for (const [id, resource] of this.resources) {
      states.set(id, resource.state)
    }
    return states
  }

  /**
   * Check if a resource is registered
   *
   * @param id - The resource identifier
   * @returns true if the resource exists
   */
  has(id: string): boolean {
    return this.resources.has(id)
  }

  /**
   * Get the total number of registered resources
   */
  get size(): number {
    return this.resources.size
  }

  /**
   * Start a managed resource
   *
   * @param id - The resource identifier
   * @throws Error if the resource is not found
   */
  async start(id: string): Promise<void> {
    const resource = this.getResource(id)

    // Validate state
    if ([ProcessState.STARTING, ProcessState.RUNNING].includes(resource.state)) {
      console.warn(`Resource "${id}" is already ${resource.state.toLowerCase()}`)
      return
    }

    if (resource.state === ProcessState.STOPPING) {
      console.warn(`Resource "${id}" is still stopping, cannot start`)
      return
    }

    // Start resource
    try {
      resource.state = ProcessState.STARTING
      resource.instance = await resource.config.start()
      resource.state = ProcessState.RUNNING
    } catch (error) {
      resource.state = ProcessState.FAILED
      resource.error = error instanceof Error ? error : new Error(String(error))
      throw error
    }
  }

  /**
   * Stop a managed resource
   *
   * @param id - The resource identifier
   * @throws Error if the resource is not found
   */
  async stop(id: string): Promise<void> {
    const resource = this.getResource(id)

    // Validate state
    if (resource.state === ProcessState.IDLE) {
      return
    }

    if ([ProcessState.STOPPING, ProcessState.STOPPED].includes(resource.state)) {
      console.warn(`Resource "${id}" is already ${resource.state.toLowerCase()}`)
      return
    }

    if (resource.state === ProcessState.STARTING) {
      console.warn(`Resource "${id}" is still starting, cannot stop`)
      return
    }

    // Stop resource
    try {
      resource.state = ProcessState.STOPPING

      let timeoutId: NodeJS.Timeout
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Resource "${id}" failed to stop within ${resource.config.timeout}ms`)), resource.config.timeout)
      })

      await Promise.race([
        resource.config.stop(resource.instance),
        timeoutPromise,
      ]).finally(() => clearTimeout(timeoutId))

      resource.state = ProcessState.STOPPED
    } catch (error) {
      resource.state = ProcessState.FAILED
      resource.error = error instanceof Error ? error : new Error(String(error))
      throw error
    }
  }

  /**
   * Stop all managed resources
   * Stops all resources in parallel and waits for completion
   *
   * @returns true if any errors occurred during shutdown
   */
  async shutdownAll(): Promise<boolean> {
    const resourceIds = Array.from(this.resources.keys())

    const stopPromises = resourceIds.map(id => this.stop(id))

    const results = await Promise.allSettled(stopPromises)

    let hasErrors = false
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        hasErrors = true
        const id = resourceIds[index]
        console.error(`Failed to stop resource "${id}":`, result.reason)
      }
    })

    return hasErrors
  }

  // ==================================================
  // Private Methods
  // ==================================================

  private getResource(id: string): ManagedResource<any> {
    const resource = this.resources.get(id)
    if (!resource) {
      throw new Error(`Resource with id "${id}" is not registered`)
    }
    return resource
  }

  private handleSignals(signals: NodeJS.Signals[]): void {
    signals.forEach(signal => {
      process.on(signal, async () => {
        if (this.isShuttingDown) {
          return
        }
        this.isShuttingDown = true

        if (this.options.onSignal) {
          try {
            await this.options.onSignal(signal)
          } catch (signalError) {
            console.error('Error in onSignal hook:', signalError)
          }
        }

        console.log(`\nReceived ${signal}, shutting down gracefully...`)
        const hasErrors = await this.shutdownAll()
        process.exit(hasErrors ? 1 : 0)
      })
    })
  }

  private handleUncaughtErrors(): void {
    const errorConfig = [{
      event: 'uncaughtException',
      logPrefix: 'Unexpected error:'
    }, {
      event: 'unhandledRejection',
      logPrefix: 'Unhandled promise:'
    }]

    errorConfig.forEach(({ event, logPrefix }) => {
      process.on(event, async error => {
        console.error(logPrefix, error)

        if (this.options.onError) {
          try {
            await this.options.onError(error)
          } catch (hookError) {
            console.error('Error in onError hook:', hookError)
          }
        }

        await this.shutdownAll()
        process.exit(1)
      })
    })
  }

}

export {
  ProcessState,
  ProcessSupervisor,
}
