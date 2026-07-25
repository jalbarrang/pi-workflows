import { prose } from "./prompt-parts.ts";

/** Standing guidance injected into the parent session's system prompt. */
export const WORKFLOW_PROMPT_GUIDELINES = [
  "Use workflow only when the user explicitly requests a workflow or multi-agent run.",
  prose(
    "Use workflow for several subagents with phase dependencies or dynamic fan-out; keep one",
    "small delegation in the parent session.",
  ),
  "In workflow scripts, agent() never throws; always check `.ok` before using its result.",
  prose(
    "A writeScope agent may relocate files with a bare `git mv` inside its fence; check",
    "`deniedCommands` on a result that claims success but changed nothing.",
  ),
  prose(
    "Mark review or verification agents `required: true` so a dead gate stops the run instead of",
    "resolving `{ ok: false }` that a terse aggregate can read as a clean pass.",
  ),
  prose(
    "Give a gate a schema field whose description demands the verbatim output of the check command,",
    "not a boolean: a model that must paste the result cannot summarize a failure into a pass.",
  ),
  prose(
    "Governed agents cannot run shell control flow, substitution, redirects, or `VAR=x` prefixes;",
    "use `find … -exec wc -l {} +` rather than a `while read` pipeline for a line gate.",
  ),
];
