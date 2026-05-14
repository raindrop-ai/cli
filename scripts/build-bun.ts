#!/usr/bin/env bun
/**
 * Build a single self-contained `raindrop` binary (which today contains the
 * `workshop` product). Outputs: build/bun/raindrop-<target>[.exe].
 *
 * Targets are Bun's `--target` triples: bun-darwin-arm64, bun-darwin-x64,
 * bun-linux-x64, bun-linux-arm64, bun-windows-x64.
 *
 * In CI we invoke this once per target on a single Linux runner; cross-compile
 * is built into Bun. Locally, the default target is the host platform.
 *
 * Usage:
 *   bun scripts/build-bun.ts                       # build for current host
 *   bun scripts/build-bun.ts --target=bun-linux-x64
 *   bun scripts/build-bun.ts --all                 # build all 5 targets
 *   bun scripts/build-bun.ts --skip-ui             # don't rebuild app/dist
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Target =
  | "bun-darwin-arm64"
  | "bun-darwin-x64"
  | "bun-linux-x64"
  | "bun-linux-arm64"
  | "bun-windows-x64";

const ALL_TARGETS: Target[] = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-windows-x64",
];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(REPO_ROOT, "app");
const APP_DIST = path.join(APP_DIR, "dist");
const ENTRY = path.join(REPO_ROOT, "src", "index.ts");
const OUT_DIR = path.join(REPO_ROOT, "build", "bun");
// UI assets are tarballed and embedded into the binary at compile time
// (via an `import ... with { type: "file" }` in src/ui-assets.ts). Path
// must match what ui-assets.ts imports — both sides resolve relative to
// repo root.
const UI_BUNDLE = path.join(REPO_ROOT, "build", "ui-bundle.tgz");

function detectHostTarget(): Target {
  const { platform, arch } = process;
  if (platform === "darwin" && arch === "arm64") return "bun-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "bun-darwin-x64";
  if (platform === "linux" && arch === "x64") return "bun-linux-x64";
  if (platform === "linux" && arch === "arm64") return "bun-linux-arm64";
  if (platform === "win32" && arch === "x64") return "bun-windows-x64";
  throw new Error(`Unsupported host platform: ${platform}-${arch}`);
}

function parseArgs(): { targets: Target[]; skipUi: boolean } {
  const args = process.argv.slice(2);
  let targets: Target[] | null = null;
  let skipUi = false;
  for (const a of args) {
    if (a === "--all") targets = [...ALL_TARGETS];
    else if (a.startsWith("--target=")) targets = [a.slice("--target=".length) as Target];
    else if (a === "--skip-ui") skipUi = true;
    else if (a === "--help" || a === "-h") {
      console.log("Usage: bun scripts/build-bun.ts [--all | --target=<target>] [--skip-ui]");
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  if (!targets) targets = [detectHostTarget()];
  for (const t of targets) {
    if (!ALL_TARGETS.includes(t)) {
      console.error(`Unknown target: ${t}\nValid: ${ALL_TARGETS.join(", ")}`);
      process.exit(2);
    }
  }
  return { targets, skipUi };
}

function run(cmd: string, args: string[], cwd: string = REPO_ROOT): void {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${result.status}`);
  }
}

function buildUi(): void {
  console.log("[build-bun] building UI (vite)…");
  run("bun", ["x", "vite", "build"], APP_DIR);
  if (!existsSync(path.join(APP_DIST, "index.html"))) {
    throw new Error(`Expected ${APP_DIST}/index.html after vite build`);
  }
}

/**
 * Embed skills/<name>/SKILL.md into src/skills.compiled.ts so the
 * compiled binary can drop them into IDE config dirs at `raindrop setup`.
 * The generated file is gitignored — regenerated every build.
 */
function embedSkills(): void {
  console.log("[build-bun] embedding skills/*/SKILL.md…");
  run("bun", [path.join(REPO_ROOT, "scripts", "embed-skills.ts")]);
}

/**
 * Embed Drizzle migration SQL files into src/db/migration-assets.ts so the
 * compiled binary can migrate a fresh DB without a loose source checkout.
 */
function embedMigrations(): void {
  console.log("[build-bun] embedding drizzle migrations…");
  run("bun", [path.join(REPO_ROOT, "scripts", "embed-migrations.ts")]);
}

/**
 * Tar+gzip the Vite output into a single asset that gets embedded into the
 * compiled binary. The compile-time import in src/ui-assets.ts (`import
 * bundlePath from "../build/ui-bundle.tgz" with { type: "file" }`) requires
 * this file to exist BEFORE `bun build --compile` runs, which is why this
 * step happens here, between buildUi() and buildOne().
 *
 * Why a tarball and not 306 individual `with { type: "file" }` imports?
 * Vite emits ~300 hashed chunks (Shiki language/theme bundles). Enumerating
 * them at build time and generating a static map works, but adds a custom
 * Express middleware. A tarball lets us keep `express.static(extracted_dir)`
 * unchanged at the cost of a one-time extraction on first daemon start.
 */
function bundleUi(): void {
  if (!existsSync(path.join(APP_DIST, "index.html"))) {
    throw new Error(`Cannot bundle UI: ${APP_DIST}/index.html missing`);
  }
  console.log(`[build-bun] bundling UI -> ${path.relative(REPO_ROOT, UI_BUNDLE)}…`);
  mkdirSync(path.dirname(UI_BUNDLE), { recursive: true });
  // -C cd into APP_DIR so the archive contains "dist/index.html" etc, not
  // the absolute path. Determinism: respect --sort=name when GNU tar is
  // available, but BSD tar (default macOS) doesn't support it; we lean on
  // tar's natural inode-order which is good enough for our use case.
  run("tar", ["-czf", UI_BUNDLE, "-C", APP_DIR, "dist"]);
  const size = statSync(UI_BUNDLE).size;
  console.log(
    `[build-bun]   \u2192 ${path.relative(REPO_ROOT, UI_BUNDLE)} (${(size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

function outputName(target: Target): string {
  const ext = target === "bun-windows-x64" ? ".exe" : "";
  return `raindrop-${target}${ext}`;
}

/**
 * Resolve the version string we embed into the binary.
 *
 *   - CI sets `RAINDROP_VERSION` from the pushed tag (release.yml `derive` step).
 *   - Local builds fall back to package.json's `version` plus a `-local` suffix,
 *     so `raindrop --version` is never blank but `raindrop update` can also
 *     refuse to "downgrade" a dev build to a real release.
 */
function resolveVersion(): string {
  const fromEnv = process.env.RAINDROP_VERSION;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
      version?: string;
    };
    if (pkg.version) return `${pkg.version}-local`;
  } catch {
    // fall through
  }
  return "0.0.0-local";
}

function buildOne(target: Target, version: string): string {
  const outfile = path.join(OUT_DIR, outputName(target));
  console.log(`[build-bun] compiling ${target} (version=${version})\u2026`);
  run("bun", [
    "build",
    "--compile",
    "--minify",
    "--bytecode",
    `--target=${target}`,
    `--define=__RAINDROP_VERSION__="${version}"`,
    ENTRY,
    "--outfile",
    outfile,
  ]);
  const size = statSync(outfile).size;
  console.log(`[build-bun]   \u2192 ${outfile} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  return outfile;
}

/**
 * Bun ad-hoc signs the host-arch darwin binary correctly (linker-signed).
 * For cross-compiled darwin binaries (e.g. x64 from arm64 host, or vice versa),
 * the embedded Bun runtime arrives carrying Bun's own Developer ID signature,
 * and the act of appending user code invalidates it without producing a fresh
 * one. So we always re-sign darwin outputs with --force --sign - to guarantee
 * a clean ad-hoc signature, regardless of host arch.
 */
function ensureAdhocSignature(outfile: string, target: Target): void {
  if (!target.startsWith("bun-darwin-")) return;
  if (process.platform !== "darwin") {
    console.log(`[build-bun]   skipping codesign on non-darwin host (CI must run on darwin)`);
    return;
  }
  const sign = spawnSync(
    "codesign",
    ["--force", "--sign", "-", "--timestamp=none", "--preserve-metadata=entitlements", outfile],
    { encoding: "utf8" },
  );
  if (sign.status !== 0) {
    throw new Error(
      `[build-bun] codesign --force --sign - failed for ${outfile}\n` +
        `${(sign.stdout ?? "") + (sign.stderr ?? "")}`,
    );
  }
  const verify = spawnSync("codesign", ["-dv", outfile], { encoding: "utf8" });
  const out = (verify.stdout ?? "") + (verify.stderr ?? "");
  if (!/Signature=adhoc/.test(out)) {
    throw new Error(
      `[build-bun] HARD GATE FAILURE: ${outfile} does not have a valid ad-hoc signature.\n` +
        `Output:\n${out}\n` +
        `This will SIGKILL on Apple Silicon. See spec \u00a7 code signing \u2014 verified positions.`,
    );
  }
  console.log(`[build-bun]   \u2713 ad-hoc signature applied + verified`);
}

function main(): void {
  const { targets, skipUi } = parseArgs();
  const version = resolveVersion();
  mkdirSync(OUT_DIR, { recursive: true });
  if (!skipUi) {
    buildUi();
  } else if (!existsSync(path.join(APP_DIST, "index.html"))) {
    throw new Error(`--skip-ui passed but ${APP_DIST}/index.html missing; run vite build first`);
  }
  // Tarball must exist before any --compile invocation reads the embed import.
  bundleUi();
  // Migration asset imports must be regenerated before --compile reads them.
  embedMigrations();
  // Skill content must be embedded (regenerates src/skills.compiled.ts)
  // before --compile runs so the import resolves.
  embedSkills();
  for (const target of targets) {
    const outfile = buildOne(target, version);
    ensureAdhocSignature(outfile, target);
  }
  console.log(`[build-bun] done (version=${version})`);
}

main();
