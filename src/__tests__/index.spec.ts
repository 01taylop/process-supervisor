import { processSupervisor } from '..'

describe('processSupervisor', () => {

  it('logs a console message', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    processSupervisor()

    expect(consoleLogSpy).toHaveBeenCalledWith('Hello, Process Supervisor!')
  })

})
