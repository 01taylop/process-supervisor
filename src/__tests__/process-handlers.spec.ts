import { ProcessState, ProcessSupervisor } from '..'

describe('Process handlers', () => {

  const logSpy = jest.spyOn(console, 'log').mockImplementation()
  const errorSpy = jest.spyOn(console, 'error').mockImplementation()
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation()
  const processOnSpy = jest.spyOn(process, 'on')

  const getSupervisorWithResource = ({
    handleSignals = false,
    handleUncaughtErrors = false,
    mockedStop = jest.fn().mockResolvedValue(undefined),
    onError,
    onSignal,
  }: {
    handleSignals?: boolean | NodeJS.Signals[],
    handleUncaughtErrors?: boolean,
    mockedStop?: jest.Mock<Promise<void>, []>,
    onError?: (error: unknown) => void | Promise<void>,
    onSignal?: (signal: string) => void | Promise<void>,
  }) => {
    const supervisor = new ProcessSupervisor({
      handleSignals,
      handleUncaughtErrors,
      onError,
      onSignal,
    })

    supervisor.register('test', {
      start: jest.fn().mockResolvedValue(undefined),
      stop: mockedStop,
    })

    return {
      supervisor,
      mockedStop,
    }
  }

  afterEach(() => {
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('uncaughtException')
    process.removeAllListeners('unhandledRejection')
  })

  describe('handleSignals', () => {

    test.each(<NodeJS.Signals[]>[
      'SIGINT',
      'SIGTERM',
    ])('calls shutdownAll and exits with 0 on %s', async signal => {
      expect.assertions(4)

      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleSignals: [signal],
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

      const error = new Error('Stop failed')
      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleSignals: [signal],
        mockedStop: jest.fn().mockRejectedValue(error)
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
    ])('calls a provided onSignal hook before shutdown on %s', async signal => {
      expect.assertions(3)

      const onSignalMock = jest.fn().mockReturnValue(undefined)
      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleSignals: [signal],
        onSignal: onSignalMock,
      })

      await supervisor.start('test')

      const handler = processOnSpy.mock.calls[0][1]
      await handler()

      expect(onSignalMock).toHaveBeenCalledWith(signal)
      expect(mockedStop).toHaveBeenCalledTimes(1)
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test.each(<NodeJS.Signals[]>[
      'SIGINT',
      'SIGTERM',
    ])('awaits an async onSignal hook before shutdown on %s', async signal => {
      expect.assertions(3)

      const onSignalMock = jest.fn().mockResolvedValue(undefined)
      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleSignals: [signal],
        onSignal: onSignalMock,
      })

      await supervisor.start('test')

      const handler = processOnSpy.mock.calls[0][1]
      await handler()

      expect(onSignalMock).toHaveBeenCalledWith(signal)
      expect(mockedStop).toHaveBeenCalledTimes(1)
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test.each(<NodeJS.Signals[]>[
      'SIGINT',
      'SIGTERM',
    ])('continues shutdown if onSignal hook throws on %s', async signal => {
      expect.assertions(4)

      const hookError = new Error('Hook failed')
      const onSignalMock = jest.fn().mockRejectedValue(hookError)
      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleSignals: [signal],
        onSignal: onSignalMock,
      })

      await supervisor.start('test')

      const handler = processOnSpy.mock.calls[0][1]
      await handler()

      expect(onSignalMock).toHaveBeenCalledWith(signal)
      expect(errorSpy).toHaveBeenCalledWith('Error in onSignal hook:', hookError)
      expect(mockedStop).toHaveBeenCalledTimes(1)
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test.each(<NodeJS.Signals[]>[
      'SIGINT',
      'SIGTERM',
    ])('handles multiple resources on %s', async signal => {
      expect.assertions(3)

      const { supervisor } = getSupervisorWithResource({
        handleSignals: [signal],
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

      const { supervisor, mockedStop } = getSupervisorWithResource({ handleSignals: true })

      await supervisor.start('test')

      const handler = processOnSpy.mock.calls[0][1]
      await handler()
      await handler()

      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(mockedStop).toHaveBeenCalledTimes(1)
      expect(exitSpy).toHaveBeenCalledTimes(1)
    })

  })

  describe('handleUncaughtErrors', () => {

    test.each([
      ['uncaughtException', 'Unexpected error:'],
      ['unhandledRejection', 'Unhandled promise:'],
    ])('calls shutdownAll and exits with 1 on %s', async (event, errorMessage) => {
      expect.assertions(4)

      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleUncaughtErrors: true,
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

    test.each([
      ['uncaughtException', 'Unexpected error:'],
      ['unhandledRejection', 'Unhandled promise:'],
    ])('calls a provided onError hook before shutdown on %s', async event => {
      expect.assertions(3)

      const onErrorMock = jest.fn().mockReturnValue(undefined)
      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleUncaughtErrors: true,
        onError: onErrorMock,
      })

      await supervisor.start('test')

      const handler = processOnSpy.mock.calls.find(call => call[0] === event)![1]
      const testError = new Error('Test error')
      await handler(testError)

      expect(onErrorMock).toHaveBeenCalledWith(testError)
      expect(mockedStop).toHaveBeenCalledTimes(1)
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test.each([
      ['uncaughtException', 'Unexpected error:'],
      ['unhandledRejection', 'Unhandled promise:'],
    ])('awaits an async onError hook before shutdown on %s', async event => {
      expect.assertions(3)

      const onErrorMock = jest.fn().mockResolvedValue(undefined)
      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleUncaughtErrors: true,
        onError: onErrorMock,
      })

      await supervisor.start('test')

      const handler = processOnSpy.mock.calls.find(call => call[0] === event)![1]
      const testError = new Error('Test error')
      await handler(testError)

      expect(onErrorMock).toHaveBeenCalledWith(testError)
      expect(mockedStop).toHaveBeenCalledTimes(1)
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test.each([
      ['uncaughtException', 'Unexpected error:'],
      ['unhandledRejection', 'Unhandled promise:'],
    ])('continues shutdown if onError hook throws on %s', async event => {
      expect.assertions(4)

      const hookError = new Error('Hook failed')
      const onErrorMock = jest.fn().mockRejectedValue(hookError)
      const { supervisor, mockedStop } = getSupervisorWithResource({
        handleUncaughtErrors: true,
        onError: onErrorMock,
      })

      await supervisor.start('test')

      const handler = processOnSpy.mock.calls.find(call => call[0] === event)![1]
      const testError = new Error('Test error')
      await handler(testError)

      expect(onErrorMock).toHaveBeenCalledWith(testError)
      expect(errorSpy).toHaveBeenCalledWith('Error in onError hook:', hookError)
      expect(mockedStop).toHaveBeenCalledTimes(1)
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

  })

})
