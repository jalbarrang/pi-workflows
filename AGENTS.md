# AGENTS.md

## What this is

A pi package that gives the model one `workflow` tool: it writes a JavaScript orchestration script, and that script runs in a permission-restricted Node child that can only call back into `agent()`, `parallel()`, and `phase()`. Each `agent()` becomes an isolated in-process pi session. Installed with `pi install`, loaded by pi as TypeScript source through jiti — there is no build step. The authoritative list of DSL options is `extensions/workflows/sandbox/option-keys.ts`; the authoritative limits are `extensions/workflows/run/limits.ts` and `extensions/workflows/sandbox/limits.ts`. Never restate either list elsewhere.

## Stack

| Area               | Tech                                                 |
| ------------------ | ---------------------------------------------------- |
| Language           | TypeScript, ESM, no build (jiti loads source)        |
| Effects / services | Effect v4, pinned exactly to `4.0.0-beta.101`        |
| Script parsing     | acorn (static only — the AST is never evaluated)     |
| Command policy     | `@dreki-gg/pi-command-sandbox` (POSIX shell parsing) |
| Tests              | `node --test` with `--experimental-strip-types`      |
| Format / lint      | oxfmt, oxlint, ESLint (line limit only)              |

## Commands

| Task                 | Command                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| Everything           | `pnpm format && pnpm typecheck && pnpm lint && pnpm line-count && pnpm test` |
| Format (write)       | `pnpm format`                                                                |
| Format (verify)      | `pnpm format:check`                                                          |
| Types                | `pnpm typecheck`                                                             |
| Lint (zero warnings) | `pnpm lint`                                                                  |
| Line + width limits  | `pnpm line-count`                                                            |
| Tests                | `pnpm test`                                                                  |
| Package audit        | `npm pack --dry-run`                                                         |

Run `pnpm format` before `pnpm format:check`, and run lint before format:check so re-expanded code cannot be re-compressed to pass.

## Rules

- **100 lines per authored file, 140 chars per code line.** Enforced by `pnpm line-count` and by `max-lines` in `eslint.config.js`. Satisfy it by splitting modules — **never** by collapsing statements onto one line. Dense one-liner code has been rejected in this repo before; readability outranks file count.
- **Effect stays exactly pinned.** No caret on `effect`. v4 is beta and has renamed core APIs mid-beta; a range would break the build silently.
- **`agent()` never throws into a workflow script.** Every failure resolves as `{ ok: false, error }`. Scripts branch on `ok`. Breaking this breaks every script ever written against the DSL.
- **Validate before scheduling.** All `agent()` option validation happens in `run/agent-options.ts` before `RunController.schedule`, so a misconfiguration costs neither a concurrency permit nor a unit of the 32-call budget.
- **Never silently ignore an option.** Unknown keys, out-of-range values, and options that would be inert in the current mode are all rejected with a message naming the valid set. This is the single most-repeated request from real use.
- **Sandbox bounds are security properties, not tuning knobs.** Byte caps, request counts, the IPC token, the capability stripping, and `--permission` are load-bearing. Do not relax one to make a test pass; report the blocker instead.
- **Services cross seams as Effect `Context.Service` + `static layer`.** `SandboxRunner`, `ArtifactStore`, `CommandPolicy`. Merge in `run/services.ts`, resolve at a boundary (`run/prepare.ts`, `run/script.ts`), then pass plain functions inward. Domain code never imports a layer.
- **`CONTEXT.md` is a glossary only.** No implementation detail. `README.md` owns user-facing docs; `docs/` owns contributor and agent docs; `docs/research/` is an as-found upstream record and is not maintained as truth.
- **Tests prove, they do not assert.** Security tests attempt real escapes. If one succeeds, that is a finding — fix the code, never soften the assertion.

## Key paths

```text
extensions/workflows/
├── index.ts        → composition root: registers the tool + command, builds the layer
├── scripting/      → parse, fail-closed meta extraction, static model refs (pure, no IO)
├── sandbox/        → child process, authenticated IPC, DSL option registry, *.cjs worker
├── agent/          → child sessions, tool policy, structured output, watchdog, transcripts
├── run/            → run aggregate, scheduling, option resolution, settle, progress
├── artifacts/      → bounded serialization, atomic writes, checkpoints
├── policy/         → command allow/deny decisions
├── presentation/   → prompts, tool renderers, /workflows dashboard, status indicator
└── __tests__/      → mirrors the tree; excluded from the published tarball
docs/               → architecture, dsl, security, testing (start at docs/README.md)
```

## Gotchas

- **Overriding a built-in tool: never also exclude its name.** pi seeds built-ins into the registry then lets `customTools` overwrite by name, but it filters custom tools through the same allow/exclude check — so excluding `bash` deletes your override too. See `agent/policy-bash.ts`.
- **`assert.deepEqual` narrows its argument** (`asserts actual is T`). Any property access after it is a type error. Put negative assertions before it.
- **`child_process.spawn` reports failure asynchronously** via an `error` event, not a throw. A `try/catch` around `spawn` catches nothing; an unhandled `error` takes down the host.
- **`allowCommands` only widens.** It feeds `extraSafe`, so a pattern like `node *` also permits `node -e '<anything>'`. Hardening must go in `policy/deny.ts` (`extraDestructive`), which is evaluated first and cannot be widened.
- **A LIFO AST worklist yields reverse source order.** Sort collected nodes by `start` before reporting, or errors list call sites backwards.
- **oxlint exits 0 on warnings** unless `--deny-warnings` is passed. It is in the `lint` script; keep it there.
- **Node's permission model follows symlinks out of granted paths.** Never rely on `--allow-fs-*` for path scoping; `agent/write-scope.ts` canonicalizes instead.
- **Windows spells PATH as `Path`** and needs `SystemRoot`. A hardcoded `PATH` key gives the child an empty search path. `sandbox/child-env.ts` owns this.
