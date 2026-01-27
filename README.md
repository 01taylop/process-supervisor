# 🛸 Process Supervisor

[![Test](https://github.com/01taylop/process-supervisor/actions/workflows/test.yml/badge.svg)](https://github.com/01taylop/process-supervisor/actions/workflows/test.yml)

![Node Versions Supported](https://img.shields.io/static/v1?label=node&message=>=18.18.0&color=blue)

A lightweight Node.js utility for managing the lifecycle of multiple resources with automatic graceful shutdown. Handles child processes, file watchers, servers, and more with zero dependencies.

- [Motivation](#motivation)

## Motivation

Building Node.js applications often involves managing multiple resources like development servers, file watchers, and background processes. Each needs proper startup, shutdown, and error handling — especially when the application exits. Without proper cleanup, you're left with orphaned processes, file handles, and lingering connections.

Writing signal handlers, managing cleanup order, and handling edge cases quickly becomes complex boilerplate that's repeated across projects.

Process Supervisor eliminates this complexity by providing a simple API that automatically handles graceful shutdown on process signals (Ctrl+C, SIGTERM) and uncaught errors. Register your resources once, and the supervisor ensures they're properly cleaned up when your application exits — no more manual signal handlers or cleanup code.

