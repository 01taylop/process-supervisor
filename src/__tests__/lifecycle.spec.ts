import { ProcessState, ProcessSupervisor } from '..'

describe('Lifecycle methods', () => {

  const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

  const getSupervisorWithResource = ({
    initialState = ProcessState.IDLE,
    mockedStart = jest.fn().mockResolvedValue(undefined),
    mockedStop = jest.fn().mockResolvedValue(undefined),
  } = {}) => {
    const supervisor = new ProcessSupervisor({ defaultTimeout: 100 })

    supervisor.register('test', {
      start: mockedStart,
      stop: mockedStop,
    })

    const resource = (supervisor as any).resources.get('test')
    resource.state = initialState

    return {
      mockedStart,
      mockedStop,
      resource,
      supervisor,
    }
  }

  describe('start', () => {

    it('throws an error if the resource is not registered', async () => {
      expect.assertions(1)

      const supervisor = new ProcessSupervisor()

      await expect(supervisor.start('test')).rejects.toThrow(
        'Resource with id "test" is not registered'
      )
    })

    test.each([
      [ProcessState.STARTING, 'Resource "test" is already starting'],
      [ProcessState.RUNNING, 'Resource "test" is already running'],
      [ProcessState.STOPPING, 'Resource "test" is still stopping, cannot start'],
    ])('warns and returns early if the resource state is %s', async (initialState, message) => {
      expect.assertions(4)

      const { mockedStart, supervisor } = getSupervisorWithResource({ initialState })

      expect(supervisor.getState('test')).toBe(initialState)

      await supervisor.start('test')

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(message)
      expect(mockedStart).not.toHaveBeenCalled()
    })

    test.each([
      ProcessState.IDLE,
      ProcessState.STOPPED,
      ProcessState.FAILED,
    ])('transitions the state from %s to STARTING to RUNNING', async initialState => {
      expect.assertions(4)

      const { mockedStart, supervisor } = getSupervisorWithResource({ initialState })

      expect(supervisor.getState('test')).toBe(initialState)

      const startPromise = supervisor.start('test')

      expect(supervisor.getState('test')).toBe(ProcessState.STARTING)

      await startPromise

      expect(supervisor.getState('test')).toBe(ProcessState.RUNNING)
      expect(mockedStart).toHaveBeenCalledTimes(1)
    })

    test.each([
      ['asynchronous', (instance: any) => Promise.resolve(instance)],
      ['synchronous', (instance: any) => instance],
    ])('stores the instance returned by %s start functions', async (_, startFn) => {
      expect.assertions(3)

      const mockInstance = { pid: 1234 }
      const { mockedStart, resource, supervisor } = getSupervisorWithResource({
        mockedStart: jest.fn().mockImplementation(() => startFn(mockInstance)),
      })

      await supervisor.start('test')

      expect(supervisor.getState('test')).toBe(ProcessState.RUNNING)
      expect(resource.instance).toBe(mockInstance)
      expect(mockedStart).toHaveBeenCalledTimes(1)
    })

    it('transitions to FAILED if start() throws an error', async () => {
      expect.assertions(3)

      const startError = new Error('Failed to spawn')
      const { resource, supervisor } = getSupervisorWithResource({
        mockedStart: jest.fn().mockRejectedValue(startError),
      })

      await expect(supervisor.start('test')).rejects.toThrow('Failed to spawn')

      expect(supervisor.getState('test')).toBe(ProcessState.FAILED)
      expect(resource.error).toEqual(startError)
    })

    it('handles non-Error objects thrown from start()', async () => {
      expect.assertions(4)

      const { resource, supervisor } = getSupervisorWithResource({
        mockedStart: jest.fn().mockRejectedValue('string error'),
      })

      await expect(supervisor.start('test')).rejects.toBe('string error')

      expect(supervisor.getState('test')).toBe(ProcessState.FAILED)
      expect(resource.error).toBeInstanceOf(Error)
      expect(resource.error?.message).toBe('string error')
    })

  })

  describe('stop', () => {

    it('throws an error if the resource is not registered', async () => {
      expect.assertions(1)

      const supervisor = new ProcessSupervisor()

      await expect(supervisor.stop('test')).rejects.toThrow(
        'Resource with id "test" is not registered'
      )
    })

    it('returns early if the resource state is IDLE', async () => {
      expect.assertions(3)

      const { mockedStop, supervisor } = getSupervisorWithResource()

      expect(supervisor.getState('test')).toBe(ProcessState.IDLE)

      await supervisor.stop('test')

      expect(warnSpy).not.toHaveBeenCalled()
      expect(mockedStop).not.toHaveBeenCalled()
    })

    test.each([
      [ProcessState.STOPPING, 'Resource "test" is already stopping'],
      [ProcessState.STOPPED, 'Resource "test" is already stopped'],
      [ProcessState.STARTING, 'Resource "test" is still starting, cannot stop'],
    ])('warns and returns early if the resource state is %s', async (initialState, message) => {
      expect.assertions(4)

      const { mockedStop, supervisor } = getSupervisorWithResource({ initialState })

      expect(supervisor.getState('test')).toBe(initialState)

      await supervisor.stop('test')

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(message)
      expect(mockedStop).not.toHaveBeenCalled()
    })

    test.each([
      ProcessState.RUNNING,
      ProcessState.FAILED,
    ])('transitions the state from %s to STOPPING to STOPPED', async initialState => {
      expect.assertions(4)

      const { mockedStop, supervisor } = getSupervisorWithResource({ initialState })

      expect(supervisor.getState('test')).toBe(initialState)

      const stopPromise = supervisor.stop('test')

      expect(supervisor.getState('test')).toBe(ProcessState.STOPPING)

      await stopPromise

      expect(supervisor.getState('test')).toBe(ProcessState.STOPPED)
      expect(mockedStop).toHaveBeenCalledTimes(1)
    })

    test.each([
      ['asynchronous', (instance: any) => Promise.resolve(instance)],
      ['synchronous', (instance: any) => instance],
    ])('passes the instance to the stop function from %s start functions', async (_, startFn) => {
      expect.assertions(2)

      const mockInstance = { pid: 1234 }
      const { mockedStop, supervisor } = getSupervisorWithResource({
        mockedStart: jest.fn().mockImplementation(() => startFn(mockInstance)),
      })

      await supervisor.start('test')
      await supervisor.stop('test')

      expect(mockedStop).toHaveBeenCalledTimes(1)
      expect(mockedStop).toHaveBeenCalledWith(mockInstance)
    })

    it('transitions to FAILED if stop() throws an error', async () => {
      expect.assertions(3)

      const stopError = new Error('Failed to kill process')
      const { resource, supervisor } = getSupervisorWithResource({
        initialState: ProcessState.RUNNING,
        mockedStop: jest.fn().mockRejectedValue(stopError),
      })

      await expect(supervisor.stop('test')).rejects.toThrow('Failed to kill process')

      expect(supervisor.getState('test')).toBe(ProcessState.FAILED)
      expect(resource.error).toEqual(stopError)
    })

    it('handles non-Error objects thrown from stop()', async () => {
      expect.assertions(4)

      const { resource, supervisor } = getSupervisorWithResource({
        initialState: ProcessState.RUNNING,
        mockedStop: jest.fn().mockRejectedValue('string error'),
      })

      await expect(supervisor.stop('test')).rejects.toBe('string error')

      expect(supervisor.getState('test')).toBe(ProcessState.FAILED)
      expect(resource.error).toBeInstanceOf(Error)
      expect(resource.error?.message).toBe('string error')
    })

    it('transitions to FAILED if stop() times out', async () => {
      expect.assertions(4)

      const { resource, supervisor } = getSupervisorWithResource({
        initialState: ProcessState.RUNNING,
        mockedStop: jest.fn().mockImplementation(() => new Promise(() => {})),
      })

      await expect(supervisor.stop('test')).rejects.toThrow('Resource "test" failed to stop within 100ms')

      expect(supervisor.getState('test')).toBe(ProcessState.FAILED)
      expect(resource.error).toBeInstanceOf(Error)
      expect(resource.error?.message).toBe('Resource "test" failed to stop within 100ms')
    })

  })

  describe('shutdownAll', () => {

  })

})
