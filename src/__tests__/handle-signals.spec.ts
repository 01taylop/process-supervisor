import { ProcessState, ProcessSupervisor } from '..'

describe('handleSignals', () => {

  const logSpy = jest.spyOn(console, 'log').mockImplementation()
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
  const errorSpy = jest.spyOn(console, 'error').mockImplementation()
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation()

  let processOnSpy: jest.SpyInstance

  beforeEach(() => {
    processOnSpy = jest.spyOn(process, 'on')
  })

  it('registers handlers for default signals', () => {
    const supervisor = new ProcessSupervisor()

    supervisor.handleSignals()

    expect(processOnSpy).toHaveBeenCalledTimes(2)
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
  })

  it('registers handlers for custom signals', () => {
    const supervisor = new ProcessSupervisor()

    supervisor.handleSignals(['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'])

    expect(processOnSpy).toHaveBeenCalledTimes(4)
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGUSR1', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGUSR2', expect.any(Function))
  })

  it('warns and returns early if called twice', () => {
    const supervisor = new ProcessSupervisor()

    supervisor.handleSignals()
    supervisor.handleSignals()

    expect(warnSpy).toHaveBeenCalledWith('Signal handlers already registered')
    expect(processOnSpy).toHaveBeenCalledTimes(2)
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
  })

  test.each(<NodeJS.Signals[]>[
    'SIGINT',
    'SIGTERM',
  ])('exits with 0 on %s', async signal => {
    expect.assertions(4)

    const supervisor = new ProcessSupervisor()

    const mockedStop = jest.fn().mockResolvedValue(undefined)
    supervisor.register('test', {
      start: () => ({ mock: true }),
      stop: mockedStop
    })

    await supervisor.start('test')
    supervisor.handleSignals([signal])

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
  ])('exits with 1 if a resource fails to stop on %s', async signal => {
    expect.assertions(5)

    const supervisor = new ProcessSupervisor()

    const error = new Error('Stop failed')
    const mockedStop = jest.fn().mockRejectedValue(error)
    supervisor.register('test', {
      start: () => ({ mock: true }),
      stop: mockedStop
    })

    await supervisor.start('test')
    supervisor.handleSignals([signal])

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
    const supervisor = new ProcessSupervisor()

    const mockedStop1 = jest.fn().mockResolvedValue(undefined)
    const mockedStop2 = jest.fn().mockResolvedValue(undefined)

    supervisor.register('resource1', { start: () => ({}), stop: mockedStop1 })
    supervisor.register('resource2', { start: () => ({}), stop: mockedStop2 })

    await supervisor.start('resource1')
    await supervisor.start('resource2')
    supervisor.handleSignals([signal])

    const handler = processOnSpy.mock.calls[0][1]
    await handler()

    expect(mockedStop1).toHaveBeenCalledTimes(1)
    expect(mockedStop2).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

})
