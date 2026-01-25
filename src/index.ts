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

  private resources: Map<string, ManagedResource<any>> = new Map()

  constructor(options: ProcessSupervisorOptions = {}) {
    this.defaultTimeout = options.defaultTimeout ?? 5000
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
   */
  async shutdownAll(): Promise<void> {
    const resourceIds = Array.from(this.resources.keys())

    const stopPromises = resourceIds.map(id => this.stop(id))

    const results = await Promise.allSettled(stopPromises)

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const id = resourceIds[index]
        console.error(`Failed to stop resource "${id}":`, result.reason)
      }
    })
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

}

export {
  ProcessState,
  ProcessSupervisor,
}
