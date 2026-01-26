import { ProcessState, ProcessSupervisor } from '..'

describe('Process handlers', () => {

  const logSpy = jest.spyOn(console, 'log').mockImplementation()
  const errorSpy = jest.spyOn(console, 'error').mockImplementation()
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation()
  const processOnSpy = jest.spyOn(process, 'on')

  afterEach(() => {
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')
  })

  test.each(<NodeJS.Signals[]>[
    'SIGINT',
    'SIGTERM',
  ])('calls shutdownAll and exits with 0 on %s', async signal => {
    expect.assertions(4)

    const supervisor = new ProcessSupervisor({
      handleSignals: [signal],
      handleUncaughtErrors: false,
    })

    const mockedStop = jest.fn().mockResolvedValue(undefined)
    supervisor.register('test', {
      start: () => ({ mock: true }),
      stop: mockedStop
    })

    await supervisor.start('test')

    const handler = processOnSpy.mock.calls[0][1]
    await handler()

    expect(logSpy).toHaveBeenCalledWith(`\nReceived ${signal}, shutting down gracefully...`)
    expect(mockedStop).toHaveBeenCalledTimes(1)
    expect(supervisor.getState('test')).toBe(ProcessState.STOPPED)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test.each(<NodeJS.Signals[]>[
    'SIGINT',
    'SIGTERM',
  ])('calls shutdownAll and exits with 1 if a resource fails to stop on %s', async signal => {
    expect.assertions(5)

    const supervisor = new ProcessSupervisor({
      handleSignals: [signal],
      handleUncaughtErrors: false,
    })

    const error = new Error('Stop failed')
    const mockedStop = jest.fn().mockRejectedValue(error)
    supervisor.register('test', {
      start: () => ({ mock: true }),
      stop: mockedStop
    })

    await supervisor.start('test')

    const handler = processOnSpy.mock.calls[0][1]
    await handler()

    expect(logSpy).toHaveBeenCalledWith(`\nReceived ${signal}, shutting down gracefully...`)
    expect(mockedStop).toHaveBeenCalledTimes(1)
    expect(supervisor.getState('test')).toBe(ProcessState.FAILED)
    expect(errorSpy).toHaveBeenCalledWith('Failed to stop resource \"test\":', error)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test.each(<NodeJS.Signals[]>[
    'SIGINT',
    'SIGTERM',
  ])('handles multiple resources on %s', async signal => {
    expect.assertions(3)

    const supervisor = new ProcessSupervisor({
      handleSignals: [signal],
      handleUncaughtErrors: false,
    })

    const mockedStop1 = jest.fn().mockResolvedValue(undefined)
    const mockedStop2 = jest.fn().mockResolvedValue(undefined)

    supervisor.register('resource1', { start: () => ({}), stop: mockedStop1 })
    supervisor.register('resource2', { start: () => ({}), stop: mockedStop2 })

    await supervisor.start('resource1')
    await supervisor.start('resource2')

    const handler = processOnSpy.mock.calls[0][1]
    await handler()

    expect(mockedStop1).toHaveBeenCalledTimes(1)
    expect(mockedStop2).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('ignores subsequent signals during shutdown', async () => {
    expect.assertions(3)

    const supervisor = new ProcessSupervisor({
      handleSignals: ['SIGINT'],
      handleUncaughtErrors: false,
    })

    const mockedStop = jest.fn().mockResolvedValue(undefined)
    supervisor.register('test', {
      start: () => ({ mock: true }),
      stop: mockedStop,
    })

    await supervisor.start('test')

    const handler = processOnSpy.mock.calls[0][1]
    await handler()
    await handler()

    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(mockedStop).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['uncaughtException', 'Unexpected error:'],
    ['unhandledRejection', 'Unhandled promise:'],
  ])('calls shutdownAll and exits with 1 on %s', async (event, errorMessage) => {
    expect.assertions(4)

    const supervisor = new ProcessSupervisor({
      handleSignals: false,
      handleUncaughtErrors: true,
    })

    const mockedStop = jest.fn().mockResolvedValue(undefined)
    supervisor.register('test', {
      start: () => ({ mock: true }),
      stop: mockedStop,
    })

    await supervisor.start('test')

    const handler = processOnSpy.mock.calls.find(call => call[0] === event)![1]

    const error = new Error('Test error')
    await handler(error)

    expect(errorSpy).toHaveBeenCalledWith(errorMessage, error)
    expect(mockedStop).toHaveBeenCalledTimes(1)
    expect(supervisor.getState('test')).toBe(ProcessState.STOPPED)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

})
