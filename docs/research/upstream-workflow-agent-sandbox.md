# Upstream workflow child-agent sandbox

## Scope

This note describes upstream commit `21f40f41fb98e088281a6fcd512388d82bddf911`. Its lockfile pins pi `0.82.0`, whose tag resolves to commit `083e61621276bff9f6faefab87ce07fcd98734e2`. [lock] [pi-tag]

## Two separate boundaries

1. **Workflow-script sandbox:** Model-authored orchestration JavaScript runs in a separate Node process with Node permission mode and a `node:vm` context. [sandbox] [worker]
2. **Child agents:** Each `agent()` request crosses authenticated IPC back to the parent and runs as an in-process pi `AgentSession`. The Node permission sandbox does not contain that session or its tools. [sandbox] [runner]

The script child can read only the worker directory. It gets no write, network, or child-process permission. It has a small environment, IPC-only standard I/O, and memory and stack limits. Its VM disables string and Wasm code generation and removes several `process` bridges. [sandbox] [worker]

The parent authenticates messages with a random token. It also enforces IPC size limits and a 32-agent-request budget. The script API is `agent`, `parallel`, `phase`, and frozen `args`. [sandbox] [worker]

## Exact child session setup

For each call, upstream creates fresh settings and resources. It then calls `createAgentSession` with the parent cwd, model, thinking level, resource loader, settings manager, and in-memory session manager. The call also gets the exclusion policy below and an optional one-shot `structured_output` tool. [index] [runner] [child]

Upstream then binds loaded extensions in headless `print` mode. It aborts and disposes the session after completion. Thus, conversation state is not persisted or shared with another child. [runner] [child]

Unless an `agent()` call overrides them, model and effort default to the parent session's model and thinking level. Every concurrent child gets a fresh extension runtime, but all children use the same cwd and parent trust decision. [index] [runner]

The exact excluded tool names are: [child]

```text
subagent_spawn, subagent_wait, subagent_cancel, subagent_check, subagent_list, workflow, ask_user
```

This is a denylist, not an allowlist. Upstream passes neither `tools` nor `noTools`. As a result, pi enables its default built-ins: `read`, `bash`, `edit`, and `write`. Pi also enables extension and custom tools unless their names are excluded. Pi applies `excludeTools` after it assembles built-in, extension, and SDK custom tools. [child] [pi-sdk] [pi-source]

## Resource loading and trust

`createChildResources` uses the normal agent directory. It creates `SettingsManager` and `DefaultResourceLoader`, not a reduced resource set. The child can load normal global and trust-aware project resources. These resources include settings, packages, extensions, skills, prompts, themes, system prompts, and context. [child] [pi-loader] [pi-packages]

The child starts extension hooks in print mode. Loaded extensions can register tools or intercept calls. [child] [pi-loader]

The workflow passes the live parent `ctx.isProjectTrusted()` result. There is no second child trust prompt. When false, pi omits project settings, trust-gated project packages, `.pi` resources, ancestor `.agents/skills`, and project system prompts. Global resources still load. Pi loads `AGENTS.md` and `CLAUDE.md` context from the agent directory and cwd ancestors regardless of project trust. [index] [pi-settings] [pi-loader] [pi-packages]

## Permission conclusion

Upstream supplies **no workflow-specific read-only mode, filesystem read restriction for agents, write-scope enforcement, or shell command policy**. It does not replace `read`, `write`, `edit`, or `bash`. The child `AgentSession` does not run in Node permission mode. Its built-ins execute in the host process with the parent cwd. The working directory is not a containment boundary. [runner] [child] [pi-source]

The workflow-specific controls are the seven-name denylist, in-memory session state, lifecycle timeouts, and optional structured-output tool. [runner] [child]

A loaded global or trusted-project extension can still override tools or enforce a policy. That behavior is ambient configuration, not a workflow extension guarantee. Pi documents that extensions execute with full system permissions. [pi-extensions]

[lock]: https://github.com/davis7dotsh/my-pi-setup/blob/21f40f41fb98e088281a6fcd512388d82bddf911/package-lock.json
[pi-tag]: https://github.com/earendil-works/pi/tree/083e61621276bff9f6faefab87ce07fcd98734e2
[sandbox]: https://github.com/davis7dotsh/my-pi-setup/blob/21f40f41fb98e088281a6fcd512388d82bddf911/extensions/workflows/sandbox.ts
[worker]: https://github.com/davis7dotsh/my-pi-setup/blob/21f40f41fb98e088281a6fcd512388d82bddf911/extensions/workflows/sandbox-child.cjs
[runner]: https://github.com/davis7dotsh/my-pi-setup/blob/21f40f41fb98e088281a6fcd512388d82bddf911/extensions/workflows/runner.ts
[index]: https://github.com/davis7dotsh/my-pi-setup/blob/21f40f41fb98e088281a6fcd512388d82bddf911/extensions/workflows/index.ts
[child]: https://github.com/davis7dotsh/my-pi-setup/blob/21f40f41fb98e088281a6fcd512388d82bddf911/extensions/shared/child-session.ts
[pi-sdk]: https://github.com/earendil-works/pi/blob/083e61621276bff9f6faefab87ce07fcd98734e2/packages/coding-agent/docs/sdk.md
[pi-source]: https://github.com/earendil-works/pi/blob/083e61621276bff9f6faefab87ce07fcd98734e2/packages/coding-agent/src/core/sdk.ts
[pi-loader]: https://github.com/earendil-works/pi/blob/083e61621276bff9f6faefab87ce07fcd98734e2/packages/coding-agent/src/core/resource-loader.ts
[pi-packages]: https://github.com/earendil-works/pi/blob/083e61621276bff9f6faefab87ce07fcd98734e2/packages/coding-agent/src/core/package-manager.ts
[pi-settings]: https://github.com/earendil-works/pi/blob/083e61621276bff9f6faefab87ce07fcd98734e2/packages/coding-agent/src/core/settings-manager.ts
[pi-extensions]: https://github.com/earendil-works/pi/blob/083e61621276bff9f6faefab87ce07fcd98734e2/packages/coding-agent/docs/extensions.md
