import { WORKFLOW_EXAMPLE_LINES } from "./prompt-example.ts";
import { prose } from "./prompt-parts.ts";

export const WORKFLOW_PARAMETER_DESCRIPTIONS = {
  script: prose(
    "JavaScript workflow script. May start with `export const meta = {...}`, then use",
    "phase(), agent(), parallel(), args, and a final `return`.",
  ),
  args: "Optional JSON string exposed as `args`; valid JSON is parsed, otherwise the raw string is used.",
  background:
    "Run in the background, return a run id immediately, and deliver a follow-up when settled.",
};
export const WORKFLOW_TOOL_DESCRIPTION = [
  prose(
    "Call the workflow tool only when the user explicitly asks for a workflow or a multi-agent",
    "run. Never start one on your own initiative for a task the user framed as a single request.",
  ),
  prose(
    "Run a multi-agent workflow from a JavaScript orchestration script written inline. Use it",
    "for ordered phases, research fan-out, per-file review, and verify-then-synthesize pipelines.",
  ),
  "The script runs as an async function body with these primitives:",
  prose(
    "• export const meta = { name, description, phases: [{ title, detail? }] } — static",
    "progress UI metadata. Declare all phases up front.",
  ),
  "• phase(title) — mark the current runtime phase using a title declared in meta.phases.",
  prose(
    "• await agent(prompt, { label?, phase?, schema?, model?, provider?, effort?, required? }) — run",
    "one isolated subagent. It always resolves { ok, output, structured?, error?, deniedCommands? };",
    "check ok before",
    "reading structured, never after. A JSON",
    "schema returns a validated object in structured after a terminating structured_output call.",
    "Pass required: true for a gate whose failure must stop the run instead of resolving ok: false.",
    "Model/provider override the parent",
    "model; effort is off|minimal|low|medium|high|xhigh|max. Children receive normal trust-aware",
    "resources but cannot orchestrate recursively or ask the user.",
  ),
  prose(
    "• await parallel([() => agent(...), ...], { concurrency? }) — run zero-argument thunks in",
    "order-preserving parallel, globally capped at 4.",
  ),
  "• args — parsed args parameter or undefined.",
  prose(
    "Workflow JavaScript runs in a restricted, killable child with no imports, eval, timers, filesystem,",
    "network, or process APIs. A run permits 32 agent calls and has no overall deadline. Each",
    "agent must emit its first assistant event in 45 seconds. Each child tool call has an",
    "independent 3-minute guard, becomes an error tool result on timeout, and leaves the agent",
    "loop free to recover. Use map/filter/if/await/template strings and return a JSON-serializable",
    "aggregate.",
  ),
  prose(
    "Use schema whenever later steps branch on a result so they consume typed fields, not prose.",
    "When a later step gates on structured output, check ok and poison the aggregate",
    "(return { status: 'unreviewed', ... }) — an empty result and an absent result are not the same",
    "thing, and `(r.structured && r.structured.blocking) || []` collapses them into a false pass.",
    "Failed runs are re-run, not resumed.",
    "Artifacts are under ~/.pi/agent/workflows/<runId>/.",
  ),
  ...WORKFLOW_EXAMPLE_LINES,
].join("\n");
export const WORKFLOW_PROMPT_SNIPPET = prose(
  "Orchestrate isolated subagents from inline JavaScript with phase(), agent(), parallel(),",
  "structured outputs, and optional background execution",
);
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
export const STRUCTURED_OUTPUT_SYSTEM_INSTRUCTION = prose(
  "When your task is complete, call the `structured_output` tool exactly once as your final action,",
  "with fields matching the required schema. Do not write any other text after it.",
);
export const STRUCTURED_OUTPUT_TOOL_DESCRIPTION = prose(
  "Return your final result as structured data matching the required schema. Call this exactly once,",
  "as your last action; do not write any other text after it.",
);
