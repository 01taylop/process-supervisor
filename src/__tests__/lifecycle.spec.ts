import { ProcessState, ProcessSupervisor } from '..'

describe('Lifecycle methods', () => {

  const mockedStart = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
  const mockedStop = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

  let supervisor: ProcessSupervisor

  beforeEach(() => {
    supervisor = new ProcessSupervisor()

    supervisor.register('test', {
      start: mockedStart,
      stop: mockedStop,
    })
  })

  describe('start', () => {

    it('throws an error if the resource is not registered', async () => {
      expect.assertions(1)

      await expect(supervisor.start('non-existent')).rejects.toThrow(
        'Resource with id "non-existent" is not registered'
      )
    })

    test.each([
      [ProcessState.STARTING, 'Resource "test" is already starting'],
      [ProcessState.RUNNING, 'Resource "test" is already running'],
      [ProcessState.STOPPING, 'Resource "test" is still stopping, cannot start'],
    ])('warns and returns early if the resource state is %s', async (state, message) => {
      expect.assertions(3)

      const resource = (supervisor as any).resources.get('test')
      resource.state = state

      await supervisor.start('test')

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(message)
      expect(resource.config.start).not.toHaveBeenCalled()
    })

    test.each([
      ProcessState.IDLE,
      ProcessState.STOPPED,
      ProcessState.FAILED,
    ])('transitions the state from %s to STARTING to RUNNING', async initialState => {
      expect.assertions(4)

      const resource = (supervisor as any).resources.get('test')
      resource.state = initialState

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
      mockedStart.mockImplementationOnce(() => startFn(mockInstance))

      await supervisor.start('test')

      const resource = (supervisor as any).resources.get('test')

      expect(supervisor.getState('test')).toBe(ProcessState.RUNNING)
      expect(resource.instance).toBe(mockInstance)
      expect(mockedStart).toHaveBeenCalledTimes(1)
    })

    it('transitions to FAILED if start() throws an error', async () => {
      expect.assertions(3)

      const startError = new Error('Failed to spawn')
      mockedStart.mockRejectedValue(startError)

      await expect(supervisor.start('test')).rejects.toThrow('Failed to spawn')

      const resource = (supervisor as any).resources.get('test')

      expect(supervisor.getState('test')).toBe(ProcessState.FAILED)
      expect(resource.error).toEqual(startError)
    })

    it('handles non-Error objects thrown from start()', async () => {
      expect.assertions(4)

      mockedStart.mockRejectedValue('string error')

      await expect(supervisor.start('test')).rejects.toBe('string error')

      const resource = (supervisor as any).resources.get('test')

      expect(supervisor.getState('test')).toBe(ProcessState.FAILED)
      expect(resource.error).toBeInstanceOf(Error)
      expect(resource.error?.message).toBe('string error')
    })

  })

  describe('stop', () => {

    it('throws an error if the resource is not registered', async () => {
      expect.assertions(1)

      await expect(supervisor.stop('non-existent')).rejects.toThrow(
        'Resource with id "non-existent" is not registered'
      )
    })

    it('returns early if the resource state is IDLE', async () => {
      expect.assertions(2)

      const resource = (supervisor as any).resources.get('test')
      resource.state = ProcessState.IDLE

      await supervisor.stop('test')

      expect(warnSpy).not.toHaveBeenCalled()
      expect(resource.config.stop).not.toHaveBeenCalled()
    })

    test.each([
      [ProcessState.STOPPING, 'Resource "test" is already stopping'],
      [ProcessState.STOPPED, 'Resource "test" is already stopped'],
      [ProcessState.STARTING, 'Resource "test" is still starting, cannot stop'],
    ])('warns and returns early if the resource state is %s', async (state, message) => {
      expect.assertions(3)

      const resource = (supervisor as any).resources.get('test')
      resource.state = state

      await supervisor.stop('test')

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(message)
      expect(resource.config.stop).not.toHaveBeenCalled()
    })

  })

  describe('shutdownAll', () => {

  })

})
