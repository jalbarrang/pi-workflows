export const AGENT_LEAF_ENV = "PI_AGENT_LEAF";
export const AGENT_LEAF_VALUE = "1";

export function isAgentLeafEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[AGENT_LEAF_ENV] === AGENT_LEAF_VALUE;
}
