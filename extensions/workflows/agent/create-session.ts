import {
  createAgentSession,
  SessionManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { compact } from "../shared/compact.ts";
import { childToolPolicy } from "./policy.ts";
import { shutdownChildSession } from "./shutdown.ts";
import { makeStructuredOutputTool } from "./structured.ts";
import { guardWorkflowChildTools } from "./timeout.ts";
import type { RunAgentOptions } from "./types.ts";

export interface CreatedSession {
  session: AgentSession;
  structured: () => unknown;
  stopGuard: () => void;
}
export async function createWorkflowSession(options: RunAgentOptions): Promise<CreatedSession> {
  let value: unknown;
  const structuredTool =
    options.schema === undefined
      ? undefined
      : makeStructuredOutputTool(options.schema, (captured) => (value = captured));
  let session: AgentSession | undefined;
  try {
    ({ session } = await createAgentSession({
      ...compact({
        cwd: options.cwd,
        model: options.model,
        thinkingLevel: options.thinkingLevel,
        resourceLoader: options.loader,
        settingsManager: options.settingsManager,
        sessionManager: SessionManager.inMemory(options.cwd),
        customTools: structuredTool ? [structuredTool] : undefined,
      }),
      ...childToolPolicy(),
    }));
    await session.bindExtensions({ mode: "print" });
    const stopGuard = guardWorkflowChildTools(session, options.toolCallTimeoutMs);
    return { session, structured: () => value, stopGuard };
  } catch (error) {
    if (session) await shutdownChildSession(session);
    throw error;
  }
}
