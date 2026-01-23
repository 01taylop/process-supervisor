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
      await expect(supervisor.start('non-existent')).rejects.toThrow(
        'Resource with id "non-existent" is not registered'
      )
    })

    test.each([
      [ProcessState.STARTING, 'Resource "test" is already starting'],
      [ProcessState.RUNNING, 'Resource "test" is already running'],
      [ProcessState.STOPPING, 'Resource "test" is still stopping, cannot start'],
    ])('warns and returns early if the resource state is %s', async (state, message) => {
      const resource = (supervisor as any).resources.get('test')
      resource.state = state

      await supervisor.start('test')

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(message)
      expect(resource.config.start).not.toHaveBeenCalled()
    })

  })

  describe('stop', () => {

    it('throws an error if the resource is not registered', async () => {
      await expect(supervisor.start('non-existent')).rejects.toThrow(
        'Resource with id "non-existent" is not registered'
      )
    })

    it('returns early if the resource state is IDLE', async () => {
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
