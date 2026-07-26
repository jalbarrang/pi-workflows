/** Run ids are `wf_` plus 12 hex characters. Anything else is not a run id. */
export const RUN_ID = /^wf_[0-9a-f]{12}$/;

/** True when a directory name is a run id, so a sweep never touches a stranger. */
export function isRunId(name: string): boolean {
  return RUN_ID.test(name);
}
