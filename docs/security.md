# Isolation model

Read this before changing anything under `sandbox/`, `policy/`, or `agent/`. Every mechanism here exists because removing it opens a concrete hole, and several were added after a test proved the hole was reachable.

## Layer 1 — the script never runs in the host

Orchestration source executes in a separate Node process spawned with `--permission`, filesystem read granted only to the worker directory, and a small heap and stack. Standard IO is discarded; the only channel is an IPC pipe. If the runtime cannot enforce `--permission`, the runner **refuses to start** rather than falling back to in-process execution. Do not add a fallback.

The environment handed to the child is the minimum needed to start: the path variable and `NODE_NO_WARNINGS`, plus `SystemRoot`/`TEMP` on Windows only. That tightness is a security property — forwarding the parent environment would hand a script every token in it. `sandbox/child-env.ts` owns it.

## Layer 2 — the child restricts itself further

Before any script runs, the worker deletes process capabilities that could escape or signal (`getBuiltinModule`, `binding`, `dlopen`, `kill`, `send`, and friends). The script is then compiled into a `vm` context with code generation disabled, so `eval` and `new Function` cannot be used to smuggle in new source. The only bindings exposed are the four DSL primitives, frozen.

Two accounting rules catch a class of model authoring bug: a run that finishes with unawaited `agent()` calls, or with calls still in flight, fails loudly instead of silently discarding work.

## Layer 3 — the IPC protocol is authenticated and bounded

Every message carries a per-run random token; a message without it kills the run. Source, arguments, results, and individual agent messages each have byte caps, prompts have a character cap, and the number of agent requests is capped. Duplicate request ids are rejected. A violation is terminal, never a warning — a script that can retry past a bound has no bound.

## Layer 4 — child agents are constrained

Child sessions get normal built-ins and trust-appropriate project resources, but recursive orchestration and user-prompting tools are denied so a workflow cannot spawn workflows or block waiting for a human. Every tool call is wrapped with an independent timeout, including tools registered later by extensions. A timeout becomes an error tool result, leaving the agent free to recover.

## Layer 5 — governed agents

An agent is _governed_ when it is `read-only` or has a `writeScope`. For governed agents:

**Commands** go through `policy/`. The command string is parsed into segments, and every segment must independently avoid the destructive list and match the safe list. Redirects and command substitution are refused. `allowCommands` widens the safe list only.

**`policy/deny.ts` cannot be widened.** This is the important part. `allowCommands` feeds the _safe_ list, so a plausible pattern such as `node *` would otherwise also permit `node -e '<anything>'`, and `sh *` would hand over an entire shell. The deny list is passed as destructive patterns, which are evaluated first, and it covers shell re-entry, PowerShell, wrappers that execute a different binary than the one matched (`env`, `xargs`, `timeout`, …), eval builtins, interpreter eval flags, and fetch-and-run launchers. Both of those escapes were live and were caught by the escape suite.

**Two mutating commands are allowed inside a fence.** A write-scoped agent may run a bare `git mv` when both operands resolve inside its scope, and a bare `mkdir` of an in-scope path. `policy/relocate.ts` and `policy/mkdir.ts` refuse on any shell metacharacter, quote, glob, extra operand, or flag outside `-v`/`-n` (`git mv`) and `-p` (`mkdir`), so `git mv a b && rm -rf .` never reaches the allowance; `agent/write-scope.ts` then answers whether each path is in scope, which means the same canonicalization that protects `write` protects this. Neither command can destroy work: `git mv` refuses to overwrite (which is why `-f` is not permitted) and `mkdir` fails on an existing file. Read-only agents get no fence and therefore neither command, and `allowCommands` still cannot widen `mv`, `cp`, `rm`, or `git mv -f`. This exists because a fenced agent that cannot rename a file or create a directory cannot perform the module extraction a fence is most wanted for — in run `wf_502f35f143f6` three agents were spent discovering that.

A rejection here names the cause — the flag, the operand count, the path outside the fence — rather than falling through to the generic read-only message. That is ergonomics, not policy: agents reach for `git mv -f` constantly, and a denial that does not say "drop the `-f`" costs a whole run.

**Writes** go through `agent/write-scope.ts`. A path is canonicalized by resolving the closest existing ancestor with the native realpath and re-appending the remainder. That single mechanism defeats two bypasses: a symlink inside the scope pointing out of it, and a case-only variant such as `Client/x` for a real `client/` on a case-insensitive filesystem. Anything resolving outside the working directory is refused before glob matching happens.

Note that Node's permission model deliberately follows symlinks out of granted paths, so it cannot be used for scoping. That is why canonicalization is done in our code.

## What is not guaranteed

State these plainly; do not let documentation imply more.

- **`allowCommands` inherits everything those commands can do.** Allowing `npm run *` allows every script in the repository's `package.json`.
- **An ungoverned agent is unrestricted.** A workflow with no `tools` and no `writeScope` gets the full built-in tool set, exactly as before this feature existed.
- **The permission model is a seat belt, not a sandbox for hostile code.** Node's own documentation says so. Our layering raises the cost of an escape; it does not make the host safe against a determined attacker who can choose the script.
- **`git mv` inside a fence is still a mutation.** It cannot clobber and cannot leave the work tree, and it is visible as a rename in the diff, but it does change the index. If that is unacceptable for a given run, do not give the agent a `writeScope`; do the relocation from the orchestrator instead.
- **A `dir/**` glob covers `dir` itself.** That is deliberate, so a directory can be relocated, but it means the fence includes the directory node and not only its contents.
- **The command parser is POSIX.** It is correct on every platform pi supports, because pi requires a bash shell on Windows too — but PowerShell syntax would not be parsed correctly, which is exactly why invoking PowerShell is denied outright rather than inspected.

## Changing any of this

If a test that attempts an escape starts passing where it used to be denied, that is a regression, not an improvement to the test. If a legitimate workflow is blocked, widen the safe list or the scope — never the deny list, and never a byte bound.
