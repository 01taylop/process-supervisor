import { ProcessState, ProcessSupervisor } from '..'

describe('ProcessState', () => {

  it('exports all expected states', () => {
    expect(ProcessState.FAILED).toBe('failed')
    expect(ProcessState.IDLE).toBe('idle')
    expect(ProcessState.RUNNING).toBe('running')
    expect(ProcessState.STARTING).toBe('starting')
    expect(ProcessState.STOPPED).toBe('stopped')
    expect(ProcessState.STOPPING).toBe('stopping')
  })

})

describe('ProcessSupervisor', () => {

  afterEach(() => {
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')
  })

  describe('constructor', () => {

    const processOnSpy = jest.spyOn(process, 'on')

    it('creates an instance with default options', () => {
      const supervisor = new ProcessSupervisor()

      expect(supervisor).toBeInstanceOf(ProcessSupervisor)
      expect(supervisor.size).toBe(0)
    })

    it('accepts a custom default timeout', () => {
      const supervisor = new ProcessSupervisor({ defaultTimeout: 10_000 })

      expect(supervisor).toBeInstanceOf(ProcessSupervisor)
      expect(supervisor.size).toBe(0)
    })

    it('registers signal handlers by default', () => {
      new ProcessSupervisor()

      expect(processOnSpy).toHaveBeenCalledTimes(4)
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function))
    })

    it('allows disabling signal handlers', () => {
      new ProcessSupervisor({ handleSignals: false })

      expect(processOnSpy).toHaveBeenCalledTimes(2)
      expect(processOnSpy).not.toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(processOnSpy).not.toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    })

    it('allows custom signals', () => {
      new ProcessSupervisor({ handleSignals: ['SIGINT', 'SIGTERM', 'SIGUSR1'] })

      expect(processOnSpy).toHaveBeenCalledTimes(5)
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('SIGUSR1', expect.any(Function))
    })

    it('allows disabling uncaught error handlers', () => {
      new ProcessSupervisor({ handleUncaughtErrors: false })

      expect(processOnSpy).toHaveBeenCalledTimes(2)
      expect(processOnSpy).not.toHaveBeenCalledWith('uncaughtException', expect.any(Function))
      expect(processOnSpy).not.toHaveBeenCalledWith('unhandledRejection', expect.any(Function))
    })

    it('allows disabling all automatic handlers', () => {
      new ProcessSupervisor({
        handleSignals: false,
        handleUncaughtErrors: false,
      })

      expect(processOnSpy).toHaveBeenCalledTimes(0)
    })

  })

  describe('register', () => {

    it('registers a new resource', () => {
      const supervisor = new ProcessSupervisor()

      supervisor.register('test', {
        start: jest.fn(),
        stop: jest.fn(),
      })

      expect(supervisor.has('test')).toBe(true)
      expect(supervisor.size).toBe(1)
    })

    it('registers a resource with a custom timeout', () => {
      const supervisor = new ProcessSupervisor()

      supervisor.register('test', {
        start: jest.fn(),
        stop: jest.fn(),
        timeout: 3_000,
      })

      expect(supervisor.has('test')).toBe(true)
      expect(supervisor.size).toBe(1)
    })

    it('sets the initial state to IDLE', () => {
      const supervisor = new ProcessSupervisor()

      supervisor.register('test', {
        start: jest.fn(),
        stop: jest.fn(),
      })

      expect(supervisor.has('test')).toBe(true)
      expect(supervisor.getState('test')).toBe(ProcessState.IDLE)
    })

    it('throws an error when registering a duplicate id', () => {
      const supervisor = new ProcessSupervisor()

      supervisor.register('duplicate', {
        start: jest.fn(),
        stop: jest.fn(),
      })

      expect(() => {
        supervisor.register('duplicate', {
          start: jest.fn(),
          stop: jest.fn(),
        })
      }).toThrow('Resource with id "duplicate" is already registered')
    })

    it('allows registering multiple resources', () => {
      const supervisor = new ProcessSupervisor()

      const resources = ['resource-1', 'resource-2', 'resource-3']
      resources.map(id => {
        supervisor.register(id, {
          start: jest.fn(),
          stop: jest.fn(),
        })
      })

      expect(supervisor.has('resource-1')).toBe(true)
      expect(supervisor.has('resource-2')).toBe(true)
      expect(supervisor.has('resource-3')).toBe(true)
      expect(supervisor.size).toBe(3)
    })

  })

  describe('unregister', () => {

    it('throws an error if the resource is not registered', async () => {
      expect.assertions(1)

      const supervisor = new ProcessSupervisor()

      await expect(supervisor.unregister('test')).rejects.toThrow(
        'Resource with id "test" is not registered'
      )
    })

    it('unregisters an existing resource', async () => {
      expect.assertions(5)

      const stopMock = jest.fn()

      const supervisor = new ProcessSupervisor()

      supervisor.register('test', {
        start: jest.fn(),
        stop: stopMock,
      })

      expect(supervisor.has('test')).toBe(true)
      expect(supervisor.size).toBe(1)

      await supervisor.unregister('test')

      expect(supervisor.has('test')).toBe(false)
      expect(supervisor.size).toBe(0)
      expect(stopMock).not.toHaveBeenCalled()
    })

    it('stops the resource if it is running before unregistering', async () => {
      expect.assertions(3)

      const stopMock = jest.fn().mockResolvedValue(undefined)

      const supervisor = new ProcessSupervisor()

      supervisor.register('test', {
        start: jest.fn(),
        stop: stopMock,
      })

      await supervisor.start('test')

      expect(supervisor.getState('test')).toBe(ProcessState.RUNNING)

      await supervisor.unregister('test')

      expect(stopMock).toHaveBeenCalledTimes(1)
      expect(supervisor.has('test')).toBe(false)
    })

  })

  describe('getState', () => {

    it('returns the current state of a resource', () => {
      const supervisor = new ProcessSupervisor()

      supervisor.register('test', {
        start: jest.fn(),
        stop: jest.fn(),
      })

      expect(supervisor.getState('test')).toBe(ProcessState.IDLE)
    })

    it('returns undefined for a non-existent resource', () => {
      const supervisor = new ProcessSupervisor()

      expect(supervisor.getState('non-existent')).toBeUndefined()
    })

  })

  describe('getAllStates', () => {

    it('returns an empty map when no resources are registered', () => {
      const supervisor = new ProcessSupervisor()
      const states = supervisor.getAllStates()

      expect(states.size).toBe(0)
    })

    it('returns states for all registered resources', () => {
      const supervisor = new ProcessSupervisor()

      const resources = ['resource-1', 'resource-2']
      resources.map(id => {
        supervisor.register(id, {
          start: jest.fn(),
          stop: jest.fn(),
        })
      })

      const states = supervisor.getAllStates()

      expect(states.size).toBe(2)
      expect(states.get('resource-1')).toBe(ProcessState.IDLE)
      expect(states.get('resource-2')).toBe(ProcessState.IDLE)
    })

  })

  describe('has', () => {

    it('returns true for a registered resource', () => {
      const supervisor = new ProcessSupervisor()

      supervisor.register('test', {
        start: jest.fn(),
        stop: jest.fn(),
      })

      expect(supervisor.has('test')).toBe(true)
    })

    it('returns false for a non-existent resource', () => {
      const supervisor = new ProcessSupervisor()

      expect(supervisor.has('non-existent')).toBe(false)
    })

  })

  describe('size', () => {

    it('returns 0 for a new supervisor', () => {
      const supervisor = new ProcessSupervisor()

      expect(supervisor.size).toBe(0)
    })

    it('returns the correct count after registering resources', () => {
      const supervisor = new ProcessSupervisor()

      supervisor.register('resource-1', {
        start: jest.fn(),
        stop: jest.fn(),
      })

      expect(supervisor.size).toBe(1)

      supervisor.register('resource-2', {
        start: jest.fn(),
        stop: jest.fn(),
      })

      expect(supervisor.size).toBe(2)
    })

  })

})
