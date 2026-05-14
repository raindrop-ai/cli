import type { AgentProviderId } from "./agent-provider";

export interface AgentSessionCommandInput {
  id: string;
  cwd?: string | null;
}

export function resumeCommandForSession(
  session: AgentSessionCommandInput,
  workspaceCwd: string | null,
  provider: AgentProviderId = "claude",
): string {
  const cwd = session.cwd ?? workspaceCwd;
  const resume =
    provider === "codex"
      ? `codex resume ${session.id}`
      : provider === "opencode"
        ? `opencode run --session ${session.id}`
        : `claude --resume ${session.id}`;
  return cwd
    ? `cd ${shellQuote(cwd)} && ${resume}`
    : resume;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
