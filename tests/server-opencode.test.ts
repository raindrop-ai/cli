import { afterAll, beforeAll, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

let app: any;
let server: any;
let originalPath: string | undefined;

beforeAll(async () => {
  process.env.RAINDROP_WORKSHOP_DB_PATH = path.join(os.tmpdir(), `workshop-server-${Date.now()}.db`);
  process.env.RAINDROP_WORKSHOP_OPENCODE_CLI_CHAT = "1";
  const binDir = path.join(os.tmpdir(), `workshop-opencode-bin-${Date.now()}`);
  fs.mkdirSync(binDir, { recursive: true });
  const opencodePath = path.join(binDir, "opencode");
  fs.writeFileSync(opencodePath, `#!/usr/bin/env node
const cwd = process.cwd();
const args = process.argv.slice(2);
if (args[0] === "--version" || args[0] === "version") {
  console.log("opencode mock 1.0.0");
  process.exit(0);
}
if (args[0] === "session" && args[1] === "list") {
  console.log(JSON.stringify([{
    id: "ses_mock",
    title: "Mock OpenCode Session",
    updated: 1778795844550,
    created: 1778795844497,
    directory: cwd
  }]));
  process.exit(0);
}
if (args[0] === "export") {
  console.log("Exporting session: ses_mock");
  console.log(JSON.stringify({
    info: {
      id: "ses_mock",
      directory: cwd,
      title: "Mock OpenCode Session",
      time: { created: 1778795844497, updated: 1778795844550 }
    },
    messages: [
      {
        info: { role: "user", id: "msg_user", time: { created: 1778795844538 } },
        parts: [{ type: "text", text: "hello from test" }]
      },
      {
        info: { role: "assistant", id: "msg_assistant", time: { created: 1778795844600 } },
        parts: [{ type: "text", text: "mock response" }]
      }
    ]
  }, null, 2));
  process.exit(0);
}
if (args[0] === "run") {
  console.log(JSON.stringify({ type: "session.status", sessionID: "ses_mock", status: "working" }));
  console.log(JSON.stringify({
    type: "message.updated",
    sessionID: "ses_mock",
    message: { role: "assistant", parts: [{ type: "text", text: "mock response" }] }
  }));
  process.exit(0);
}
console.error("unexpected opencode args", JSON.stringify(args));
process.exit(1);
`);
  fs.chmodSync(opencodePath, 0o755);
  originalPath = process.env.PATH;
  process.env.PATH = `${binDir}:${process.env.PATH ?? ""}`;
  const mod = await import("../src/server");
  const db = await import("../src/db");
  const created = await mod.createServer(0);
  app = created.app;
  server = created.server;
  (globalThis as any).__closeDb = db.closeDb;
});

afterAll(() => {
  if (originalPath !== undefined) process.env.PATH = originalPath;
  server?.close?.();
  (globalThis as any).__closeDb?.();
});

test("server accepts opencode as the active provider", async () => {
  const setRes = await request(app)
    .post("/api/agent/provider")
    .send({ provider: "opencode" });

  expect(setRes.status).toBe(200);
  expect(setRes.body.provider).toBe("opencode");

  const getRes = await request(app).get("/api/agent/provider");
  expect(getRes.status).toBe(200);
  expect(getRes.body.provider).toBe("opencode");
});

test("status payload exposes opencode availability", async () => {
  const res = await request(app).get("/api/status");
  expect(res.status).toBe(200);
  expect(res.body.opencode).toEqual(expect.objectContaining({ mode: "opencode_exec_stream" }));
});

test("sessions route supports the opencode provider", async () => {
  await request(app).post("/api/agent/provider").send({ provider: "opencode" });
  const res = await request(app).get("/api/agent/sessions");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test("messages route can execute a mocked OpenCode CLI turn successfully", async () => {
  await request(app).post("/api/agent/provider").send({ provider: "opencode" });
  const res = await request(app)
    .post("/api/agent/messages")
    .send({ content: "hello from test", session_id: null, run_id: null, client_message_id: "msg-test" });

  expect(res.status).toBe(200);
  expect(res.body.text).toBe("mock response");
});

test("session detail route returns OpenCode-exported messages", async () => {
  await request(app).post("/api/agent/provider").send({ provider: "opencode" });
  const res = await request(app).get("/api/agent/sessions/ses_mock");

  expect(res.status).toBe(200);
  expect(res.body.id).toBe("ses_mock");
  expect(res.body.messages.map((message: { role: string }) => message.role)).toEqual(["user", "assistant"]);
});

test("messages route returns an OpenCode session detail, not a Codex session", async () => {
  await request(app).post("/api/agent/provider").send({ provider: "opencode" });
  const res = await request(app)
    .post("/api/agent/messages")
    .send({ content: "hello from test", session_id: null, run_id: null, client_message_id: "msg-test" });

  expect(res.status).toBe(200);
  expect(res.body.session_id).toBe("ses_mock");
  expect(res.body.text).toBe("mock response");
  expect(res.body.session).toEqual(expect.objectContaining({
    id: "ses_mock",
    preview: "hello from test",
  }));
  expect(res.body.events.map((event: { type: string }) => event.type)).toEqual(["provider_session", "loadout", "status"]);
});
