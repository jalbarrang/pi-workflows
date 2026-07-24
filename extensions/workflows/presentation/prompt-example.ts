import { code } from "./prompt-parts.ts";

/**
 * The worked example in the tool description.
 *
 * It shows fan-out with a schema *and* the safe way to consume one: a gate marked
 * `required` and an `.ok` check before `.structured`, because the terse
 * alternative silently turns a dead reviewer into a clean review.
 */
export const WORKFLOW_EXAMPLE_LINES = [
  "Example:",
  code(
    "export const meta = { name: 'reliability-review', description: 'Review modules, then report',",
    " phases: [{ title: 'Scan' }, { title: 'Report' }] }",
  ),
  code(
    "const FINDINGS = { type: 'object', properties: { issues: { type: 'array', items: ",
    "{ type: 'string' } }, ok: { type: 'boolean' } }, required: ['issues', 'ok'] }",
  ),
  "phase('Scan')",
  code(
    "const scans = await parallel(args.files.map((file) => () => agent(`Review ${file} for ",
    "correctness and reliability risks.`, { label: `scan:${file}`, phase: 'Scan', ",
    "schema: FINDINGS })))",
  ),
  "const findings = scans.filter((result) => result.ok).map((result) => result.structured)",
  "phase('Report')",
  code(
    "const report = await agent(`Summarize: ${JSON.stringify(findings)}`, ",
    "{ label: 'report', phase: 'Report', required: true })",
  ),
  "if (!report.ok) return { status: 'unreported', findings, error: report.error }",
  "return { findings, report: report.output }",
];
