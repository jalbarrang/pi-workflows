# Research: BAML for workflow-JavaScript validation (as found 2026-08-04)

## Recommendation

**Do not integrate BAML for the current user-authored JavaScript workflow DSL.** Keep Acorn as the syntax/AST boundary and extend its DSL-specific static rules only where a false positive is unacceptable. Re-evaluate only if the product chooses a BAML-native workflow language; BAML is a separate compiled language, not a validator or type checker for JavaScript.

## Local CLI evidence

The local installation is the Homebrew wrapper, not a BAML toolchain. It therefore cannot run `check`, `lint`, or any compiler command today:

```text
$ baml --version
baml wrapper 0.2.3
baml toolchain not installed (canary)
Run: baml toolchain use canary

$ baml --help
error: no BAML toolchain is installed.
Run: baml toolchain use canary
Or:  baml toolchain use nightly

$ baml toolchain list
default selector: canary
installed toolchains: (none)

Remote versions were not checked.
Run: baml toolchain status
```

`baml toolchain --help` says `use`, `install`, and `update` may download or change local state. None was run for this research. `baml` resolves to `/opt/homebrew/bin/baml`, a symlink to Homebrew Cellar package `baml/0.2.3`.

## Repository fit

The current boundary is deliberately JavaScript plus selective static analysis:

- `scripting/meta.ts` parses with Acorn, rejects imports and non-static `export const meta`, then removes only that declaration before sandbox execution.
- `scripting/model-refs.ts` walks the Acorn AST and preflights only literal `agent()` `model`/`provider` pairs. Dynamic expressions are deliberately skipped rather than falsely rejected.
- `sandbox/option-keys.ts` is the option-key authority. IPC and `run/agent-options.ts` then validate unknown keys, values, and inert combinations before scheduling; these checks necessarily use runtime pi model and policy context.
- The JS body is intentionally expressive and runs only in the existing permission-restricted Node/vm child. The sandbox, authenticated bounded IPC, and the `agent()`-never-throws result contract are not merely syntax rules.

This makes Acorn the correct mechanism for static claims about the existing syntax. It can add targeted AST diagnostics without changing source language, execution semantics, sandboxing, or the dynamic-configuration policy.

## What BAML offers, and the mismatch

Boundary describes current BAML as a TypeScript-like programming language with a statically checked type system, runtime types, compiler diagnostics, tests, and a `baml check` command. The current official source defines `check` as checking every BAML source file in a discovered project and errors when no `.baml` files exist. It does not claim to parse, lint, or type-check JavaScript.

Accordingly, a BAML toolchain could validate a *replacement* DSL written as `.baml`: typed `agent` options, typed results, required handling, and perhaps typed phase data could make many authoring mistakes unrepresentable. It cannot incrementally validate the present JavaScript body. Calling BAML from TypeScript through its generated SDK is also not JavaScript DSL analysis; it only makes BAML functions callable by TypeScript.

A migration would require a new surface language, project/source-file lifecycle, compilation and execution bridge for pi's async `agent` callbacks, a mapping of JSON Schema and model-registry semantics, artifact/source-location support, and a security review of a second runtime. It would not remove the need for host-side validation: model availability, command policy, write scope, IPC bounds, and sandbox capability restrictions are runtime facts.

## Available now versus announced or unavailable

| Status | Evidence and consequence |
| --- | --- |
| Available upstream, not locally installed | The canary source implements `baml check` for `.baml` compiler errors; the official site documents `baml run`, `describe`, tests, and a typed language. This is valuable only after adopting BAML source. |
| Available in this repository | Acorn syntax/meta/model-reference analysis plus exact runtime validation already cover the JS DSL without a language migration. |
| Not available for this use case | No installed toolchain exists, and no official source or documentation found for a JavaScript frontend, a JavaScript workflow-DSL linter, or an Acorn/ESTree adapter. Do not infer one from the TypeScript SDK. |
| Announced, not available | Boundary marks reflection/code-mode and function-mocking sandboxing as “Coming soon.” The site also says mocking does not replace machine sandboxing. Neither is a present JS static validator nor a substitute for this repository's Node isolation. |

The upstream type-system document itself says it is prescriptive and that not all specified features work yet. Treat its stronger type guarantees as an evaluation input for a future language decision, not as a present integration contract.

## Sources

- Official BAML quickstart: <https://boundaryml.com/quickstart>
- Official BAML language overview, type-system claims, SDK adoption, and explicitly announced reflection/mocking: <https://boundaryml.com/explore>
- Official BAML source README: <https://github.com/BoundaryML/baml>
- Official canary source inspected at `bffb53eaf9c9a443a577cf247a92f23a69dfc849`: <https://github.com/BoundaryML/baml/tree/bffb53eaf9c9a443a577cf247a92f23a69dfc849>
- `baml check` source (`.baml` project discovery and compiler diagnostics): <https://github.com/BoundaryML/baml/blob/bffb53eaf9c9a443a577cf247a92f23a69dfc849/baml_language/crates/baml_cli/src/check_command.rs>
- Official-source check documentation: <https://github.com/BoundaryML/baml/blob/bffb53eaf9c9a443a577cf247a92f23a69dfc849/baml_language/crates/baml_builtins2/keyword_docs/baml_keywords.yaml>
- Official-source type-system caveat and design: <https://github.com/BoundaryML/baml/blob/bffb53eaf9c9a443a577cf247a92f23a69dfc849/baml_language/TYPE_SYSTEM.md>
