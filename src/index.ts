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
}

export {
  ProcessState,
  ProcessSupervisor,
}
