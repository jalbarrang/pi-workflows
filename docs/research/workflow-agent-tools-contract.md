# Workflow agent `tools` / `writeScope` contract

> **Historical record:** This note describes the workflow-specific permission system that was removed after the upstream comparison in `upstream-workflow-agent-sandbox.md`. It is not the current DSL contract.

Researched 2026-08-04 against this working tree and installed `@earendil-works/pi-coding-agent` 0.83.0. Let `$PI` mean `/Users/jalbarran/.bun/install/global/node_modules/@earendil-works/pi-coding-agent`. All evidence below is first-party source, tests, or documentation.

## Conclusion

Workflow `agent(..., { tools })` does not inherit pi's meaning of `tools`. It is a one-value mode switch: the only accepted value is the string `"read-only"`. Omission preserves normal child tools, while `writeScope` is the separate write-fencing mechanism. The repeated array mistake is predictable because pi's CLI, SDK, extension API, preset example, and sibling subagent example all use tool-name allowlists nearby.

The smallest robust fix is not to add an allowlist or rename the public option. Add one explicit model-facing sentence near the `agent()` signature, replace the lossy runtime diagnostic, and cover the existing runtime/preflight seams.

## Exact child contract

All modes create an in-memory pi session with trust-aware resources, bind extensions, and apply the independent tool timeout. They always exclude `workflow`, `subagent`, the compatibility `subagent_*` names, and `ask_user`; other extension tools remain available. A schema additionally installs `structured_output`. Sources: `extensions/workflows/agent/create-session.ts:L20-L43`, `extensions/workflows/agent/policy.ts:L1-L22`, `extensions/workflows/agent/child-tools.ts:L21-L46`, `extensions/workflows/__tests__/child-orchestration-tools.test.ts:L25-L45`.

- **Default, with neither option:** The workflow passes no pi SDK `tools` allowlist. Installed pi therefore activates `read`, `bash`, `edit`, and `write` by default, then activates allowed extension/custom tools. Bash and built-in writes are not workflow-governed. Sources: `extensions/workflows/run/tools-resolution.ts:L9-L15`, `extensions/workflows/agent/child-tools.ts:L17-L20`, `$PI/dist/core/sdk.js:L132-L136`, `$PI/dist/core/agent-session.js:L1995-L2015`.
- **`tools: "read-only"`:** The child excludes tool names `write` and `edit`; it deliberately does not exclude `bash`, because the workflow's custom `bash` must replace the built-in. That replacement applies the read-only command policy. `allowCommands` can widen the safe-command side, but redirects, substitution, shell re-entry, destructive patterns, and each unsafe chain segment remain denied. Sources: `extensions/workflows/agent/policy.ts:L12-L20`, `extensions/workflows/agent/child-tools.ts:L29-L44`, `extensions/workflows/policy/service.ts:L11-L45`, `extensions/workflows/__tests__/command-policy.test.ts:L5-L46`.
- **`writeScope: [globs...]`:** The child keeps `write` and `edit` but replaces both with wrappers that canonicalize the target, reject cwd escapes, and require a glob match. Bash receives the same governed baseline, plus narrowly parsed bare `git mv` and `mkdir` operations whose paths are inside the fence. Sources: `extensions/workflows/agent/scoped-tools.ts:L8-L32`, `extensions/workflows/agent/write-scope.ts:L42-L88`, `extensions/workflows/agent/child-tools.ts:L29-L46`, `extensions/workflows/policy/service.ts:L13-L23`.
- **Combination rules:** `writeScope` must be a non-empty string array and is rejected with `tools: "read-only"`; `allowCommands` is valid only with exactly one governing mode. All validation precedes scheduling. Sources: `extensions/workflows/run/tools-resolution.ts:L18-L70`, `extensions/workflows/run/agent-options.ts:L52-L74`, `extensions/workflows/run/agent-call.ts:L32-L42`.

“Read-only” and “write-scoped” govern the built-in `write`/`edit` names and the workflow's `bash` replacement; they are not generic capability sandboxes for every extension tool. The test fixture proves that an unrelated extension tool remains in a child. Sources: `extensions/workflows/agent/policy.ts:L1-L20`, `extensions/workflows/__tests__/child-orchestration-tools.test.ts:L25-L45`.

## Why an allowlist is a reasonable wrong guess

- Pi CLI `--tools` is explicitly a comma-separated allowlist across built-in, extension, and custom tools; its documented read-only example is `--tools read,grep,find,ls`. Sources: `$PI/README.md:L575-L584`, `$PI/README.md:L624-L652`, `$PI/dist/cli/args.js:L85-L95`.
- Pi SDK `CreateAgentSessionOptions.tools` is `string[]`, documented as an allowlist, with examples such as `tools: ["read", "bash"]` and read-only `tools: ["read", "grep", "find", "ls"]`. Sources: `$PI/dist/core/sdk.d.ts:L34-L45`, `$PI/dist/core/sdk.d.ts:L90-L103`, `$PI/docs/sdk.md:L491-L519`.
- Pi's extension API exposes `getActiveTools(): string[]` and `setActiveTools(names)`, including `setActiveTools(["read", "bash"])` as read-only. Source: `$PI/docs/extensions.md:L1624-L1642`.
- Pi's bundled preset example contains the exact observed form, `"tools": ["read", "bash", "edit", "write"]`, and says it replaces the default set. Source: `$PI/examples/extensions/preset.ts:L12-L27`, `$PI/examples/extensions/preset.ts:L48-L59`.
- Pi's sibling subagent example parses comma-separated frontmatter `tools` into `string[]` and forwards it through CLI `--tools`. Sources: `$PI/examples/extensions/subagent/agents.ts:L11-L18`, `$PI/examples/extensions/subagent/agents.ts:L52-L67`, `$PI/examples/extensions/subagent/index.ts:L294-L296`.

This workflow package overloads the same noun while internally calling that SDK without forwarding the workflow option. The semantic collision, not model irrationality, is the primary authoring cause.

## Model-facing surface inventory

Pi places `promptSnippet` in “Available tools” and `promptGuidelines` in the system-prompt guidelines; the full tool definition also carries its description and outer parameter schema. Sources: `$PI/docs/extensions.md:L1337-L1347`, `$PI/dist/core/system-prompt.js:L39-L68`.

- `WORKFLOW_TOOL_DESCRIPTION` lists `tools?`, `allowCommands?`, and `writeScope?` but defines none of them. Its worked example uses none. Sources: `extensions/workflows/presentation/prompt.ts:L33-L48`, `extensions/workflows/presentation/prompt-example.ts:L10-L34`.
- `WORKFLOW_PROMPT_GUIDELINES` mentions one `writeScope` relocation rule and governed-shell limits, but does not say that `tools` is a mode, that omission is writable, or that arrays are invalid. Source: `extensions/workflows/presentation/prompt-guidelines.ts:L3-L27`.
- `WORKFLOW_PROMPT_SNIPPET` and the outer `script` parameter description contain no nested option semantics. The TypeBox schema can type only the outer inline-script string, not JavaScript inside it. Sources: `extensions/workflows/presentation/prompt.ts:L6-L18`, `extensions/workflows/presentation/prompt.ts:L83-L86`, `extensions/workflows/tool.ts:L4-L11`.
- The only other prompt strings here are child-facing structured-output instructions; they appropriately describe only `structured_output`. Source: `extensions/workflows/presentation/prompt.ts:L87-L94`.
- The auto-loaded repository `AGENTS.md` points agents to the authoritative option registry and validation invariant but intentionally does not restate option semantics. Source: `AGENTS.md:L3-L5`, `AGENTS.md:L37-L40`.
- The root README and contributor docs are accurate when read: the README demonstrates both valid forms and says omission is unrestricted; `docs/dsl.md` states the one accepted mode and mutual exclusion; `docs/security.md` states child and governed behavior. Sources: `README.md:L30-L45`, `README.md:L58-L77`, `docs/dsl.md:L40-L62`, `docs/security.md:L21-L50`.

Thus the durable docs are not wrong. The omission is on the automatic parent-model surfaces used while authoring the inline script.

## Smallest robust fix

1. Add this sentence immediately after the `agent()` option signature in `WORKFLOW_TOOL_DESCRIPTION`: **“Workflow `tools` is not a tool-name allowlist: omit it for normal child tools, use only `tools: "read-only"` to remove `write`/`edit`, or use `writeScope: ["path/**"]` to fence `write`/`edit`; `tools` and `writeScope` are mutually exclusive.”** Do not expand the worked example or duplicate the full option reference.
2. Replace `String(options.tools)` validation. The current array becomes the misleading CSV-like `invalid tools "read,bash,edit,write" (use read-only)`. Use: **“invalid `tools`: workflow `tools` is a mode, not a tool-name allowlist; omit it for normal child tools, use `tools: "read-only"` to remove write/edit, or use `writeScope: ["path/**"]` to fence write/edit”**. Preserve `{ ok: false, error }` and pre-scheduling validation. Source: `extensions/workflows/run/tools-resolution.ts:L9-L15`.
3. Do not accept arrays as aliases. That would create a second tool-selection contract, interact ambiguously with extension tools, and weaken the clear governed/ungoverned split merely to tolerate an authoring error.

## Regression seams

- In `extensions/workflows/__tests__/read-only-agent.test.ts`, pass the exact four-name array and assert the “mode, not a tool-name allowlist” guidance, plus that the value is not flattened into CSV. Existing mode/default assertions at `L13-L38` and `L64-L95` remain the behavioral guard.
- In `extensions/workflows/__tests__/script-preflight.test.ts`, use a literal array and assert the same diagnostic with `1:7`. Arrays are already statically decoded, and preflight reuses the runtime resolver. Sources: `extensions/workflows/scripting/literals.ts:L18-L44`, `extensions/workflows/run/script-preflight.ts:L21-L53`.
- Add a small prompt-contract assertion against `WORKFLOW_TOOL_DESCRIPTION` so the high-value sentence cannot disappear during prompt compression. There is currently no test of the workflow prompt constants.
- Existing `write-scope.test.ts:L85-L95`, `escape-scope.test.ts:L17-L39`, and `child-orchestration-tools.test.ts:L25-L45` already cover mode resolution, installed wrappers, and surviving non-orchestration extension tools; no new live-model test is needed.
