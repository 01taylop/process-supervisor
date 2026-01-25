import { spawn } from 'node:child_process'

import { jest } from '@jest/globals'

import { ProcessSupervisor as ProcessSupervisorESM, ProcessState } from '../lib/index.js'

import type { ChildProcess } from 'node:child_process'

// @ts-ignore - CJS build doesn't have type definitions
const { ProcessSupervisor: ProcessSupervisorCJS } = await import('../lib/index.cjs')

describe.each([
  ['ESM', ProcessSupervisorESM],
  ['CJS', ProcessSupervisorCJS],
])('Integration tests - %s', (_format, ProcessSupervisor) => {

  const SLEEP_PROCESS = {
    start: () => spawn('sleep', ['10']),
    stop: (proc: ChildProcess) => {
      proc.kill('SIGTERM')
      return new Promise(resolve => proc.on('exit', resolve))
    }
  }

  test('starting and stopping a child process', async () => {
    expect.assertions(4)

    const supervisor = new ProcessSupervisor()

    supervisor.register('sleep', SLEEP_PROCESS)

    await supervisor.start('sleep')
    const resource = (supervisor as any).resources.get('sleep')

    expect(resource.instance.killed).toBe(false)
    expect(supervisor.getState('sleep')).toBe(ProcessState.RUNNING)

    await supervisor.stop('sleep')

    expect(resource.instance.killed).toBe(true)
    expect(supervisor.getState('sleep')).toBe(ProcessState.STOPPED)
  })

  test('restarting a stopped process', async () => {
    expect.assertions(5)

    const supervisor = new ProcessSupervisor()

    supervisor.register('sleep', SLEEP_PROCESS)

    await supervisor.start('sleep')
    const resource = (supervisor as any).resources.get('sleep')
    const firstPid = resource.instance.pid

    await supervisor.stop('sleep')
    await supervisor.start('sleep')
    const secondPid = resource.instance.pid

    await supervisor.stop('sleep')

    expect(firstPid).toBeGreaterThan(0)
    expect(secondPid).toBeGreaterThan(0)
    expect(secondPid).not.toBe(firstPid)
    expect(resource.instance.killed).toBe(true)
    expect(supervisor.getState('sleep')).toBe(ProcessState.STOPPED)
  })

  test('managing multiple processes', async () => {
    expect.assertions(8)

    const supervisor = new ProcessSupervisor()

    supervisor.register('sleep1', SLEEP_PROCESS)
    supervisor.register('sleep2', SLEEP_PROCESS)

    expect(supervisor.getState('sleep1')).toBe(ProcessState.IDLE)
    expect(supervisor.getState('sleep2')).toBe(ProcessState.IDLE)

    await supervisor.start('sleep1')

    expect(supervisor.getState('sleep1')).toBe(ProcessState.RUNNING)
    expect(supervisor.getState('sleep2')).toBe(ProcessState.IDLE)

    await supervisor.start('sleep2')

    expect(supervisor.getState('sleep1')).toBe(ProcessState.RUNNING)
    expect(supervisor.getState('sleep2')).toBe(ProcessState.RUNNING)

    await supervisor.shutdownAll()

    expect(supervisor.getState('sleep1')).toBe(ProcessState.STOPPED)
    expect(supervisor.getState('sleep2')).toBe(ProcessState.STOPPED)
  })

  test('managing mixed resource types', async () => {
    expect.assertions(5)

    const supervisor = new ProcessSupervisor()

    supervisor.register('sleep', SLEEP_PROCESS)

    const mockWatcher = { close: jest.fn(() => Promise.resolve()) }
    supervisor.register('watcher', {
      start: () => mockWatcher,
      stop: (w: any) => w.close()
    })

    await supervisor.start('sleep')
    await supervisor.start('watcher')

    expect(supervisor.getState('sleep')).toBe(ProcessState.RUNNING)
    expect(supervisor.getState('watcher')).toBe(ProcessState.RUNNING)

    await supervisor.shutdownAll()

    expect(supervisor.getState('sleep')).toBe(ProcessState.STOPPED)
    expect(supervisor.getState('watcher')).toBe(ProcessState.STOPPED)
    expect(mockWatcher.close).toHaveBeenCalledTimes(1)
  })

  test('handling a process that fails to start', async () => {
    expect.assertions(2)

    const supervisor = new ProcessSupervisor()

    supervisor.register('invalid', {
      start: () => {
        throw new Error('Failed to start process')
      },
      stop: () => {}
    })

    await expect(supervisor.start('invalid')).rejects.toThrow()
    expect(supervisor.getState('invalid')).toBe(ProcessState.FAILED)
  })

  test('enforcing a timeout when a process fails to stop', async () => {
    expect.assertions(3)

    const supervisor = new ProcessSupervisor({
      defaultTimeout: 200
    })

    supervisor.register('hang', {
      start: () => spawn('sleep', ['10']),
      stop: () => new Promise(() => {}),
    })

    await supervisor.start('hang')

    expect(supervisor.getState('hang')).toBe(ProcessState.RUNNING)

    await expect(supervisor.stop('hang')).rejects.toThrow('failed to stop within 200ms')
    expect(supervisor.getState('hang')).toBe(ProcessState.FAILED)

    // Cleanup: kill the hanging process
    const resource = (supervisor as any).resources.get('hang')
    resource.instance.kill('SIGKILL')
  })

})
