# Internal docs

Contributor and agent documentation for `@dreki-gg/pi-workflows`. User-facing usage lives in the root `README.md`; domain vocabulary lives in `CONTEXT.md`; the invariants an agent must not break live in `AGENTS.md`.

| Document                           | Owns                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| [agent-output.md](agent-output.md) | Per-agent output artifacts, and why a prompt never carries a previous agent's text.             |
| [architecture.md](architecture.md) | Bounded contexts, seams, service layers, and the run lifecycle end to end.                      |
| [dsl.md](dsl.md)                   | The workflow script contract: primitives, option semantics, validation order, failure shapes.   |
| [gates.md](gates.md)               | Writing a gate that catches work that did not happen and records executable evidence.           |
| [security.md](security.md)         | The isolation model layer by layer, and an explicit statement of what is and is not guaranteed. |
| [testing.md](testing.md)           | Gate commands, test layout, and the rules for writing security tests.                           |

## Reading order

Start with [architecture.md](architecture.md) for the module map, then read the document covering the area you are changing. Read [security.md](security.md) before touching anything under `sandbox/` or `agent/` — those modules carry guarantees that are easy to weaken by accident and hard to notice.

## Not maintained as truth

`research/workflows-extension.md` is a point-in-time record of the upstream extension this package was ported from, kept for provenance. It describes upstream behavior and upstream file layout, not this codebase. Do not treat it as current, and do not update it to match changes here.

`research/baml-workflow-validation.md` records the BAML toolchain and integration fit as found during this change. Recheck the upstream toolchain before you use its conclusions for a later language decision.

`research/upstream-workflow-agent-sandbox.md` records how the upstream workflow extension isolates scripts and child agents at a pinned commit. Recheck upstream before using it for a later security decision.

`research/workflow-agent-tools-contract.md` is a historical record of the removed workflow-specific permission modes. It is not the current DSL contract.

`feedback/` is untracked and gitignored. It holds local dogfood reports that may reference private repositories, so it must never be committed.
