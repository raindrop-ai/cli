import { expect, test } from "bun:test";
import { resumeCommandForSession, shellQuote } from "../app/src/utils/agent-session-command";

test("resumeCommandForSession generates the OpenCode resume command", () => {
  expect(
    resumeCommandForSession(
      { id: "ses_demo", cwd: "/tmp/demo workspace" },
      null,
      "opencode",
    ),
  ).toBe("cd '/tmp/demo workspace' && opencode run --session ses_demo");
});

test("resumeCommandForSession falls back to the workspace cwd when the session has none", () => {
  expect(
    resumeCommandForSession(
      { id: "ses_demo" },
      "/tmp/project",
      "codex",
    ),
  ).toBe("cd '/tmp/project' && codex resume ses_demo");
});

test("shellQuote escapes embedded single quotes", () => {
  expect(shellQuote("/tmp/it's-here")).toBe("'/tmp/it'\\''s-here'");
});
