import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

type Theme = ExtensionContext["ui"]["theme"];
export function activityStatus(
  theme: Theme,
  counts: { running: number; done: number; failed: number },
) {
  const parts: string[] = [];
  if (counts.running) parts.push(theme.fg("warning", `■ ${counts.running} running`));
  if (counts.done) parts.push(theme.fg("success", `■ ${counts.done} done`));
  if (counts.failed) parts.push(theme.fg("error", `■ ${counts.failed} failed`));
  parts.push(theme.fg("accent", "/workflows") + theme.fg("dim", " to view"));
  return `${theme.fg("muted", "workflows:")} ${parts.join(theme.fg("dim", " · "))}`;
}
