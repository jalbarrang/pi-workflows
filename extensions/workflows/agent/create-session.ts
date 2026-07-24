import {
  createAgentSession,
  SessionManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { buildChildCustomTools } from "./child-tools.ts";
import { childToolPolicy } from "./policy.ts";
import { shutdownChildSession } from "./shutdown.ts";
import { guardWorkflowChildTools } from "./timeout.ts";
import type { RunAgentOptions } from "./types.ts";

export interface CreatedSession {
  session: AgentSession;
  structured: () => unknown;
  stopGuard: () => void;
}
export async function createWorkflowSession(options: RunAgentOptions): Promise<CreatedSession> {
  let value: unknown;
  const customTools = buildChildCustomTools(options, (captured) => (value = captured));
  let session: AgentSession | undefined;
  try {
    ({ session } = await createAgentSession({
      cwd: options.cwd,
      ...(options.model ? { model: options.model } : {}),
      ...(options.thinkingLevel ? { thinkingLevel: options.thinkingLevel } : {}),
      resourceLoader: options.loader,
      settingsManager: options.settingsManager,
      sessionManager: SessionManager.inMemory(options.cwd),
      ...(customTools.length > 0 ? { customTools } : {}),
      ...childToolPolicy(options.readOnly === true),
    }));
    await session.bindExtensions({ mode: "print" });
    const stopGuard = guardWorkflowChildTools(session, options.toolCallTimeoutMs);
    return { session, structured: () => value, stopGuard };
  } catch (error) {
    if (session) await shutdownChildSession(session);
    throw error;
  }
}
