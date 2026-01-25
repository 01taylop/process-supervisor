import { spawn } from 'node:child_process'

import { ProcessSupervisor as ProcessSupervisorESM, ProcessState } from '../lib/index.js'

import type { ChildProcess } from 'node:child_process'

// @ts-ignore - CJS build doesn't have type definitions
const { ProcessSupervisor: ProcessSupervisorCJS } = await import('../lib/index.cjs')

describe.each([
  ['ESM', ProcessSupervisorESM],
  ['CJS', ProcessSupervisorCJS],
])('Integration tests - %s', (_format, ProcessSupervisor) => {

  test('starting and stopping a child process', async () => {
    expect.assertions(5)

    const supervisor = new ProcessSupervisor()

    supervisor.register('sleep', {
      start: () => spawn('sleep', ['10']),
      stop: (proc: ChildProcess) => {
        proc.kill('SIGTERM')
        return new Promise(resolve => proc.on('exit', resolve))
      }
    })

    await supervisor.start('sleep')

    const resource = (supervisor as any).resources.get('sleep')
    expect(resource.instance.pid).toBeGreaterThan(0)
    expect(resource.instance.killed).toBe(false)
    expect(supervisor.getState('sleep')).toBe(ProcessState.RUNNING)

    await supervisor.stop('sleep')

    expect(resource.instance.killed).toBe(true)
    expect(supervisor.getState('sleep')).toBe(ProcessState.STOPPED)
  })

})
