# Testing

## Running the gates

The full sequence, which is also what CI runs on both Linux and Windows:

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm line-count && pnpm test && npm pack --dry-run
```

Order matters in two places. Run `pnpm format` before `pnpm format:check` so formatting is applied rather than merely reported, and run `pnpm lint` before `format:check` so code cannot be compressed onto fewer lines to satisfy the line gate.

Tests run under `node --test` with `--experimental-strip-types`, so TypeScript executes directly with no build. Several suites spawn real child processes so the workflow-script permission boundary is tested instead of mocked.

## Layout

`extensions/workflows/__tests__/` mirrors the source tree and is excluded from the published tarball by the `files` whitelist in `package.json`. One concern per file, each under the same 100-line limit as source. Shared setup lives in the `*-fixture.ts` files rather than being re-declared.

Suites group by what they protect: option and resolution behavior, the run controller's budget and cancellation semantics, artifact bounding and atomicity, agent timing and transcript projection, service-layer wiring, and the sandbox protocol.

## Writing tests for security behavior

The `sandbox-*` suites exist to _prove_ the workflow-script boundary, not only to describe it. Two rules:

**A passing escape is a finding.** If an orchestration script reaches a forbidden host capability, fix the code and report it. Never weaken the assertion to make the suite green.

**Assert the negative and the positive.** Every sandbox change needs a companion check that a valid workflow still runs. Hardening that breaks valid orchestration is incomplete.

## Testing across platforms

Platform-dependent code takes the platform as a parameter instead of reading `process.platform` internally, so both branches are testable on one machine — see `sandbox/child-env.ts` and `sandbox/terminate.ts`. Prefer that shape over mutating globals or skipping.

Forcing another platform's branch locally can surface real bugs: exercising the Windows termination path on macOS revealed that a failed `spawn` reports through an asynchronous `error` event, so the surrounding `try`/`catch` caught nothing and an unhandled event would have taken down the host process.

Where a case genuinely cannot run on a platform — privileged symlink creation, filesystem case sensitivity — gate that single assertion with a comment naming the reason. Never skip a whole suite.

## Testing Effect seams

Because services are resolved at boundaries and passed inward as plain functions, most code needs no Effect machinery in tests. When a test does need a seam, supply `Layer.succeed(Service, { ... })` and provide it — see `effect-services.test.ts` for both the production layer and a substituted test layer. A test should never need a live model, a real session, or network access.

## What is not covered

No test exercises a real provider call, so the end-to-end path from a live model through a child session is unverified by CI; it is covered by manual dogfooding instead. Windows CI is configured but only proves itself once a run happens on a `windows-latest` runner — treat a first Windows CI run as a real verification step, not a formality.
