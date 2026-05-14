import { spawn } from "child_process";
import React, { useEffect, useState } from "react";
import { Box, Text, render, useApp, useInput, type Key } from "ink";
import {
  cancel,
  outro,
} from "@clack/prompts";
import { VERSION } from "./version";

export type DripItemId = "hat" | "umbrella" | "sticker";

interface DripItem {
  id: DripItemId;
  label: string;
  remaining: number;
  matrix?: readonly string[];
  displayWidth?: number;
  displayHeight?: number;
  fillGaps?: boolean;
}

const h = React.createElement;
const GITHUB_REPO = "invisible-tools/raindrop-workshop";
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
const DEFAULT_DRIP_CLAIM_URL = "https://www.raindrop.ai/api/drip-claims";
const CARD_WIDTH = 46;
const CARD_HEIGHT = 24;
const STICKER_BOX_HEIGHT = CARD_HEIGHT;
const STICKER_RAIN_HEIGHT = 19;
const STAR_PROMPT_ARM_MS = 250;

const SHADE_SYMBOLS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_~";
const MIN_VISIBLE_SOURCE_TONE = 2;

const UMBRELLA_MATRIX = [
  "               sY",
  "             VVWSQNO",
  "          XacafZXVMONMI",
  "        UdmggYURRQNOMMKLI",
  "       bjqrgcXTSQQOOMNNMJF",
  "      XiqqibYURSPQMOMKKIKFD",
  "     bjrtmeYVTSQOPONLMJJIEEA",
  "    VhqqjdZVUSPPOOLNKKKHJFDBB",
  "   TeqplfdZUSPQRNOMMLMIJIECAB",
  "   WorkhfcYVRSRQOOOPLMKILFCBAC",
  "  bgnkffdaYTTQRPPPLOKLKHKEEABB9",
  "  ajmjegdcXSSQRPOONOLMKIJFEABB9",
  " SdkjgdeecYTSQQQOONNKKJIIGDABB95",
  " TchedcfdcVSUPRNKPMOKKHHGDC9BB84",
  " XaXRTRYfbWSPM 15 AMKIGF43349A73",
  "WSF     NXVL   44   JJB      2AA",
  "Y         T    79    H         B",
  "               FD",
  "               MK",
  "               NM",
  "               NN",
  "               PK",
  "               PL",
  "               QM",
  "               pP",
  "               SN",
  "               QP",
  "               OK",
  "               NE   BQ",
  "               MF   EV",
  "               NMB CPO",
  "                KSSPN",
  "                 CKM",
] as const;

const CAP_MATRIX = [
  "                                  QQN",
  "                                 KMGBG",
  "                            cgefdRICCA865",
  "                         XceeffYSLGBB7E4459",
  "                       ZdeeeeXNOJHDC785E32375",
  "                      afefeWQLLGGGC69464D211586",
  "                    UdhgeZQNLJHHFCC968355D0202AA",
  "                   VcffcSOLKFHFDBB9784523B3 1 19A8",
  "                  OdfeZRNJJGGDDCC996542316A    1889",
  "                 ScgfYROIIGGDDD9A9A4453203C      899",
  "                 YeeZQPJIHFCEDAC885733312178     08A",
  "                XafaSOJKFHEDCAB8967352211175      28B",
  "                YdcTPLKEFEECAC8A764533111 38       89",
  "               UdcWQNIHEDDCBA9A6765332111128       2A7",
  "               YcYRKIGFDCBAA995754422210  17        77",
  "               ZdQOJHFDF9C99877445342010 018        3A8",
  "              UdXPKGEDDAB8A696563432 21  1 9         88",
  "              aaVLIDFCCC7A78567352302      7         4A",
  "              cdPNEFDDB89876673523120 1   16         49",
  "              bYQIGCCAAA877653523212 1 0  07         39",
  "             TbZKIDCBA9A5855562323211 1    9         3A",
  "             UbSLED8989674846343212 00    16         28",
  "             ZZRHEAA98774645324122010 1    8         48",
  "            VWYVTSPQQPJ666634514201000   0 6         1A",
  "          RYbZTLJFGECBDHHGGD83512221  0   16         39",
  "         adcbSKGEBB8876553449EBDA72 1     85         49",
  "       bbfZRLHDBBC8687552331112018BBA11   7         288",
  "     cdgcUOKGDAAA6744632312110 1     978858        255",
  "   YdeeUNJIGC997874653320300  0          68      3557",
  "  ZcbYPMIIEAC9867553322 201    0          12",
  " bedbaVWTOBB786664432202 0  1            24",
  "MNIFBACADFOLMB6444321110                25",
  "I3     83  BBJL97331110              1034",
  "3             7HI923200             1 54",
  "                4EF3211 1          218",
  "                  3ED602 1    0  2359",
  "                    9BC520 011 3499",
  "                      6CCABA88CAA",
  "                         6899966",
] as const;

const ITEMS: DripItem[] = [
  {
    id: "hat",
    label: "raindrop field cap",
    remaining: 200,
    matrix: CAP_MATRIX,
    displayWidth: 30,
    displayHeight: 14,
    fillGaps: true,
  },
  {
    id: "umbrella",
    label: "raindrop umbrella",
    remaining: 50,
    matrix: UMBRELLA_MATRIX,
    displayWidth: 25,
    displayHeight: 15,
  },
  {
    id: "sticker",
    label: "sticker",
    remaining: 500,
  },
];

function printHelp(): void {
  console.log(`raindrop drip - choose Raindrop merch

USAGE
    raindrop drip

WHAT IT DOES
    Opens an Ink-powered terminal picker with the first drops:
      field cap   200 remaining
      umbrella     50 remaining
      sticker     500 remaining

    After you choose an item, the CLI asks for your email and submits a claim
    while supplies last. Shipping details are collected separately.

OPTIONS
    -h, --help    Print this help.
    --email EMAIL Submit a claim without an interactive email prompt.

ENVIRONMENT
    RAINDROP_DRIP_CLAIM_URL Override the claim endpoint for testing.
`);
}

function openInBrowser(url: string): void {
  let cmd: string;
  let args: string[];
  if (process.platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (process.platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {
      // The printed URL still gives users a manual path if opening fails.
    });
    child.unref();
  } catch {
    // The printed URL still gives users a manual path if opening fails.
  }
}

interface GhStarResult {
  ok: boolean;
  reason?: string;
}

interface DripClaimSuccess {
  ok: true;
  status: "created";
  claimId?: string;
  item?: DripItemId;
  remaining?: number | null;
  createdAt?: string;
}

interface DripClaimFailure {
  ok: false;
  status: string;
  error: string;
  claimId?: string;
  item?: DripItemId;
  remaining?: number | null;
  createdAt?: string;
}

type DripClaimResult = DripClaimSuccess | DripClaimFailure;

async function starWithGh(): Promise<GhStarResult> {
  return new Promise((resolve) => {
    const child = spawn("gh", ["api", "-X", "PUT", `/user/starred/${GITHUB_REPO}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    child.stdout?.on("data", (chunk) => output.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => output.push(Buffer.from(chunk)));
    child.on("error", (err) => resolve({ ok: false, reason: err.message }));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      const message = Buffer.concat(output).toString("utf8").trim();
      resolve({
        ok: false,
        reason: message || `gh exited with code ${code ?? "unknown"}`,
      });
    });
  });
}

async function completeGitHubStar(method: "api" | "browser"): Promise<"api" | "browser"> {
  if (method === "api") {
    const starred = await starWithGh();
    if (starred.ok) return "api";

    if (isDevMode()) {
      console.log(`gh repo star failed: ${starred.reason}`);
      console.log("Opening GitHub in the browser instead.");
    }
    openInBrowser(GITHUB_URL);
    return "browser";
  }

  openInBrowser(GITHUB_URL);
  return "browser";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmailArg(emailArg?: string): string | null | undefined {
  if (emailArg !== undefined) {
    const email = emailArg.trim();
    if (!isValidEmail(email)) {
      console.error("invalid email: expected something like you@example.com");
      return null;
    }
    return email;
  }
  return undefined;
}

function coerceItemId(value: unknown): DripItemId | undefined {
  return value === "hat" || value === "umbrella" || value === "sticker" ? value : undefined;
}

async function submitDripClaim(input: {
  email: string;
  item: DripItemId;
  starMethod: "api" | "browser";
}): Promise<DripClaimResult> {
  const url = process.env.RAINDROP_DRIP_CLAIM_URL ?? DEFAULT_DRIP_CLAIM_URL;
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": `raindrop-cli/${VERSION}`,
      },
      body: JSON.stringify({
        email: input.email,
        item: input.item,
        star_method: input.starMethod,
        cli_version: VERSION,
        platform: `${process.platform}-${process.arch}`,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      status: "network_error",
      error: (err as Error).message,
    };
  }

  const raw = await response.json().catch(() => null) as {
    claim?: {
      id?: string;
      status?: string;
      item?: unknown;
      remaining?: number | null;
      created_at?: string;
    };
    status?: string;
    error?: string;
    claim_id?: string;
    item?: unknown;
    remaining?: number | null;
    created_at?: string;
  } | null;

  if (response.ok && raw?.claim?.status === "created") {
    return {
      ok: true,
      status: "created",
      claimId: raw.claim.id,
      item: coerceItemId(raw.claim.item),
      remaining: raw.claim.remaining,
      createdAt: raw.claim.created_at,
    };
  }

  return {
    ok: false,
    status: raw?.status ?? `http_${response.status}`,
    error: raw?.error ?? `Claim API returned HTTP ${response.status}`,
    claimId: raw?.claim_id,
    item: coerceItemId(raw?.item),
    remaining: raw?.remaining,
    createdAt: raw?.created_at,
  };
}

function itemLabel(item: DripItemId): string {
  return ITEMS.find((entry) => entry.id === item)?.label ?? item;
}

function printClaimResult(result: DripClaimResult, selection: DripSelection, email: string): number {
  const item = result.item ?? selection.item;
  if (result.ok) {
    console.log(`Claim reserved for ${email}: ${itemLabel(item)}.`);
    outro("We'll follow up by email for shipping details.");
    return 0;
  }

  if (result.status === "duplicate") {
    console.log(`${email} has already claimed ${itemLabel(item)}.`);
    outro("You're on the claim list. We'll follow up by email for shipping details.");
    return 0;
  }

  if (result.status === "sold_out") {
    console.error(`${itemLabel(item)} is sold out.`);
    return 1;
  }

  console.error(`Claim failed: ${result.error}`);
  return 1;
}

interface DripArgs {
  email?: string;
}

function parseDripArgs(args: string[]): DripArgs | number {
  const parsed: DripArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      return 0;
    }
    if (arg === "--email") {
      const email = args[++i];
      if (!email) {
        console.error("missing value for --email");
        return 64;
      }
      parsed.email = email;
      continue;
    }
    if (arg.startsWith("--email=")) {
      parsed.email = arg.slice("--email=".length);
      continue;
    }
    console.error(`unknown flag: ${arg}`);
    return 64;
  }
  return parsed;
}

function isDevMode(): boolean {
  const execName = process.execPath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  return !execName.startsWith("raindrop");
}

function abort(): number {
  cancel("Drip cancelled.");
  return 130;
}

function StaticFallback(): React.ReactElement {
  return h(
    Box,
    { flexDirection: "column", gap: 1 },
    h(Text, { color: "cyanBright", bold: true }, "raindrop drip"),
    h(Box, { gap: 2 }, ...ITEMS.filter((item) => item.matrix).map((item) => h(ItemCard, {
      key: item.id,
      item,
      selected: item.id === "hat",
    }))),
    h(StickerOption, { selected: false, frame: 0 }),
  );
}

interface DripSelection {
  item: DripItemId;
  starMethod: "api" | "browser";
  email?: string;
}

function DripApp({
  emailArg,
  onDone,
  onCancel,
}: {
  emailArg?: string;
  onDone: (selection: DripSelection) => void;
  onCancel: () => void;
}): React.ReactElement {
  const app = useApp();
  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState<"item" | "star" | "email">("item");
  const [starMethod, setStarMethod] = useState<"api" | "browser">("api");
  const [starPromptArmed, setStarPromptArmed] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((value) => value + 1), 120);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (step !== "star") {
      setStarPromptArmed(false);
      return;
    }
    const timer = setTimeout(() => setStarPromptArmed(true), STAR_PROMPT_ARM_MS);
    return () => clearTimeout(timer);
  }, [step]);

  useInput((input: string, key: Key) => {
    if (key.escape || key.ctrl || (step !== "email" && input === "q")) {
      onCancel();
      app.exit();
    } else if (step === "item") {
      if (key.leftArrow || input === "h") setSelected((current: number) => (current + ITEMS.length - 1) % ITEMS.length);
      else if (key.rightArrow || input === "l") setSelected((current: number) => (current + 1) % ITEMS.length);
      else if (key.return) setStep("star");
    } else if (step === "star") {
      if (!starPromptArmed) return;
      if (key.leftArrow || input === "h" || key.rightArrow || input === "l") {
        setStarMethod((current: "api" | "browser") => current === "api" ? "browser" : "api");
      }
      else if (key.return) {
        if (emailArg) {
          onDone({ item: ITEMS[selected].id, starMethod, email: emailArg });
          app.exit();
        } else {
          setStep("email");
        }
      }
    } else if (step === "email") {
      if (key.return) {
        const trimmed = email.trim();
        if (!trimmed) {
          setEmailError("Email is required");
        } else if (!isValidEmail(trimmed)) {
          setEmailError("Enter a valid email");
        } else {
          onDone({ item: ITEMS[selected].id, starMethod, email: trimmed });
          app.exit();
        }
      } else if (key.backspace || key.delete) {
        setEmail((current: string) => current.slice(0, -1));
        setEmailError(null);
      } else if (input) {
        setEmail((current: string) => current + input.replace(/[\r\n]/g, ""));
        setEmailError(null);
      }
    }
  });

  const item = ITEMS[selected];

  return h(
    Box,
    { flexDirection: "column", paddingX: 1, paddingY: 1, gap: 1 },
    h(
      Box,
      { flexDirection: "column" },
      h(Text, { color: "cyanBright", bold: true }, "raindrop drip"),
      h(Text, { color: "gray" }, "choose your drop"),
    ),
    h(
      Box,
      { gap: 2 },
      ...ITEMS.filter((item) => item.matrix).map((item) => h(ItemCard, {
        key: item.id,
        item,
        selected: ITEMS[selected].id === item.id,
      })),
      h(StickerOption, { selected: ITEMS[selected].id === "sticker", frame }),
    ),
    h(
      Text,
      { color: "gray" },
      h(Text, null, "use "),
      h(Text, { color: "whiteBright" }, "<-"),
      h(Text, null, " / "),
      h(Text, { color: "whiteBright" }, "->"),
      h(Text, null, " to move, "),
      h(Text, { color: "whiteBright" }, "enter"),
      h(Text, null, " to choose, "),
      h(Text, { color: "whiteBright" }, "q"),
      h(Text, null, " to quit"),
    ),
    step === "star" && h(StarPrompt, { item, starMethod }),
    step === "email" && h(EmailPrompt, { item, email, emailError }),
  );
}

function EmailPrompt({
  item,
  email,
  emailError,
}: {
  item: DripItem;
  email: string;
  emailError: string | null;
}): React.ReactElement {
  return h(
    Box,
    { flexDirection: "column", marginTop: 1 },
    h(Text, null, `${item.label} selected`),
    h(Box, { height: 1 }),
    h(Text, null, "Email for claim updates"),
    h(
      Text,
      null,
      h(Text, { color: "green" }, "> "),
      h(Text, null, email || "you@example.com"),
      h(Text, { color: "whiteBright" }, email ? "█" : ""),
    ),
    emailError && h(Text, { color: "red" }, emailError),
  );
}

function StarPrompt({
  item,
  starMethod,
}: {
  item: DripItem;
  starMethod: "api" | "browser";
}): React.ReactElement {
  const useApi = starMethod === "api";
  return h(
    Box,
    { flexDirection: "column", marginTop: 1 },
    h(Text, null, `${item.label} selected`),
    h(Text, null, `${item.remaining} remaining before backend reservations`),
    h(Box, { height: 1 }),
    h(Text, null, "Liking Workshop? Star us on GitHub."),
    h(
      Text,
      null,
      h(Text, { color: useApi ? "green" : "gray" }, `${useApi ? "●" : "○"} Yes (via API)`),
      h(Text, { color: "gray" }, " / "),
      h(Text, { color: useApi ? "gray" : "green" }, `${useApi ? "○" : "●"} Open Browser`),
    ),
  );
}

function StickerOption({ selected, frame }: { selected: boolean; frame: number }): React.ReactElement {
  return h(
    Box,
    {
      borderStyle: "round",
      borderColor: selected ? "whiteBright" : "gray",
      flexDirection: "column",
      width: 24,
      height: STICKER_BOX_HEIGHT,
      paddingX: 2,
      paddingY: 1,
    },
    h(
      Box,
      { justifyContent: "space-between", width: "100%" },
      h(Text, { color: selected ? "whiteBright" : "gray", bold: selected }, `${selected ? "> " : "  "}sticker`),
      h(Text, { color: selected ? "green" : "gray", bold: selected }, "∞"),
    ),
    h(RainField, { frame }),
    selected && h(Text, { color: "whiteBright" }, "enter to claim"),
  );
}

function RainField({ frame }: { frame: number }): React.ReactElement {
  const width = 18;
  const height = STICKER_RAIN_HEIGHT;
  const layers = [
    { columns: [1, 7, 14], speed: 0.55, length: 2, tones: ["#252b30", "#465159"], glyphs: ["·", "˙"], offset: 1 },
    { columns: [3, 10, 16], speed: 0.9, length: 3, tones: ["#303840", "#6f7b84", "#aeb8be"], glyphs: ["·", "┆", "│"], offset: 5 },
    { columns: [5, 12], speed: 1.35, length: 4, tones: ["#3d464d", "#7f8b93", "#c5cdd2", "#f3f6f7"], glyphs: ["·", "┆", "│", "╽"], offset: 9 },
    { columns: [8], speed: 1.9, length: 5, tones: ["#2b3238", "#59646c", "#919da4", "#d8dee2", "#ffffff"], glyphs: ["·", "┆", "│", "╽", "╿"], offset: 13 },
  ];

  return h(
    Box,
    { flexDirection: "column" },
    ...Array.from({ length: height }, (_, row) => h(
      Box,
      { key: row, width },
      ...Array.from({ length: width }, (_, col) => {
        const drop = rainCell(layers, frame, row, col, height);
        const mist = !drop && isMist(frame, row, col);
        return h(Text, {
          key: col,
          color: drop?.tone ?? (mist ? "#252b30" : "black"),
        }, drop?.glyph ?? (mist ? "·" : " "));
      }),
    )),
  );
}

function rainCell(
  layers: Array<{ columns: number[]; speed: number; length: number; tones: string[]; glyphs: string[]; offset: number }>,
  frame: number,
  row: number,
  col: number,
  height: number,
): { tone: string; glyph: string } | null {
  for (const layer of layers) {
    for (const rainCol of layer.columns) {
      const drift = Math.sin((frame + rainCol * 3) * 0.17) > 0.75 ? 1 : 0;
      const head = (Math.floor(frame * layer.speed) + layer.offset + rainCol * 2) % (height + layer.length + 3);
      const localCol = rainCol + drift;
      const age = head - row;
      if (col === localCol && age >= 0 && age < layer.length) {
        const index = layer.length - 1 - age;
        return {
          tone: layer.tones[Math.min(index, layer.tones.length - 1)],
          glyph: layer.glyphs[Math.min(index, layer.glyphs.length - 1)],
        };
      }
    }
  }
  return null;
}

function isMist(frame: number, row: number, col: number): boolean {
  return ((row * 17 + col * 31 + Math.floor(frame / 3) * 7) % 97) === 0;
}

function ItemCard({
  item,
  selected,
}: {
  item: DripItem;
  selected: boolean;
}): React.ReactElement {
  const borderColor = selected ? "whiteBright" : "gray";
  const titleColor = selected ? "whiteBright" : "gray";
  const displayMatrix = resampleMatrix(item.matrix!, item.displayWidth!, item.displayHeight!);
  const artMatrix = item.fillGaps ? shadeCapMatrix(removeCapStrays(fillMatrixGaps(displayMatrix))) : displayMatrix;

  return h(
    Box,
    {
      borderStyle: "round",
      borderColor,
      flexDirection: "column",
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      paddingX: 2,
      paddingY: 1,
    },
    h(
      Box,
      { justifyContent: "space-between", width: "100%" },
      h(
        Box,
        { flexGrow: 1, marginRight: 1 },
        h(Text, { color: titleColor, bold: selected, wrap: "truncate-end" }, `${selected ? "> " : "  "}${item.label}`),
      ),
      h(
        Box,
        { flexShrink: 0 },
        h(Text, { color: selected ? "green" : "gray", bold: selected, wrap: "truncate" }, `${item.remaining} left`),
      ),
    ),
    h(Box, { height: 2 }),
    h(DotMatrixArt, { matrix: artMatrix }),
    h(Box, { flexGrow: 1 }),
    h(Text, { color: selected ? "whiteBright" : "gray" }, selected ? "enter to claim" : "              "),
  );
}

function DotMatrixArt({ matrix }: { matrix: readonly string[] }): React.ReactElement {
  const width = matrixWidth(matrix);
  return h(
    Box,
    { flexDirection: "column", alignItems: "center", width: "100%" },
    ...matrix.map((row, rowIndex) => h(
      Box,
      { key: rowIndex, width, justifyContent: "center" },
      ...dotSegments(row.padEnd(width), rowIndex),
    )),
  );
}

function dotSegments(row: string, rowIndex: number): React.ReactElement[] {
  const segments: React.ReactElement[] = [];
  let col = 0;
  while (col < row.length) {
    const cell = dotCellForShade(row[col]);
    let end = col + 1;
    while (end < row.length && sameDotCell(cell, dotCellForShade(row[end]))) end++;
    segments.push(h(Text, {
      key: `${rowIndex}-${col}`,
      color: cell.color,
    }, cell.char.repeat(end - col)));
    col = end;
  }
  return segments;
}

function matrixWidth(matrix: readonly string[]): number {
  return Math.max(...matrix.map((row) => row.length));
}

function dotCellForShade(shade: string): { char: string; color: string } {
  const value = decodeTone(shade);
  if (value <= 0) return { char: " ", color: "black" };
  const t = (value - 1) / 63;
  const curved = Math.pow(t, 1.05);
  if (curved < 0.28) return { char: "▪", color: "#4f565c" };
  if (curved < 0.72) return { char: "▪", color: "#8b949b" };
  return { char: "▪", color: "#d9e0e4" };
}

function sameDotCell(a: { char: string; color: string }, b: { char: string; color: string }): boolean {
  return a.char === b.char && a.color === b.color;
}

function encodeTone(value: number): string {
  const clamped = Math.max(1, Math.min(64, Math.round(value)));
  return SHADE_SYMBOLS[clamped - 1];
}

function decodeTone(shade: string): number {
  const index = SHADE_SYMBOLS.indexOf(shade);
  return index === -1 ? 0 : index + 1;
}

function resampleMatrix(matrix: readonly string[], targetWidth: number, targetHeight: number): string[] {
  const sourceWidth = matrixWidth(matrix);
  const sourceHeight = matrix.length;
  const padded = matrix.map((row) => row.padEnd(sourceWidth));
  const rows: string[] = [];

  for (let y = 0; y < targetHeight; y++) {
    let row = "";
    const y0 = Math.floor((y / targetHeight) * sourceHeight);
    const y1 = Math.max(y0 + 1, Math.ceil(((y + 1) / targetHeight) * sourceHeight));

    for (let x = 0; x < targetWidth; x++) {
      const x0 = Math.floor((x / targetWidth) * sourceWidth);
      const x1 = Math.max(x0 + 1, Math.ceil(((x + 1) / targetWidth) * sourceWidth));
      let sum = 0;
      let lit = 0;
      let max = 0;
      let min = 64;
      let total = 0;

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          total++;
          const value = sourceTone(padded[sy]?.[sx] ?? " ");
          if (value > 0) {
            sum += value;
            lit++;
            max = Math.max(max, value);
            min = Math.min(min, value);
          }
        }
      }

      if (lit === 0) {
        row += " ";
      } else {
        const average = sum / lit;
        const coverage = lit / total;
        const sourceContrast = max >= 58
          ? max
          : max >= 46 || min <= 12
            ? average * 0.55 + max * 0.45
            : average;
        const detailFloor = coverage < 0.28 && max <= 18 ? MIN_VISIBLE_SOURCE_TONE : 0;
        row += encodeTone(Math.max(detailFloor || MIN_VISIBLE_SOURCE_TONE, sourceContrast));
      }
    }

    rows.push(row.replace(/\s+$/g, ""));
  }

  return rows;
}

function fillMatrixGaps(matrix: readonly string[]): string[] {
  const width = matrixWidth(matrix);
  const padded = matrix.map((row) => row.padEnd(width));
  return padded.map((row, y) => {
    let next = "";
    for (let x = 0; x < width; x++) {
      const current = sourceTone(row[x]);
      if (current > 0) {
        next += row[x];
        continue;
      }

      const left = sourceTone(row[x - 1] ?? " ");
      const right = sourceTone(row[x + 1] ?? " ");
      const up = sourceTone(padded[y - 1]?.[x] ?? " ");
      const down = sourceTone(padded[y + 1]?.[x] ?? " ");
      const diagonalHits = [
        padded[y - 1]?.[x - 1],
        padded[y - 1]?.[x + 1],
        padded[y + 1]?.[x - 1],
        padded[y + 1]?.[x + 1],
      ].filter((shade) => sourceTone(shade ?? " ") > 0).length;

      if ((left > 0 && right > 0) || (up > 0 && down > 0) || (diagonalHits >= 3 && left + right + up + down > 0)) {
        const neighborAverage = [left, right, up, down].filter((tone) => tone > 0).reduce((sum, tone, _, tones) => sum + tone / tones.length, 0);
        next += encodeTone(Math.max(MIN_VISIBLE_SOURCE_TONE, neighborAverage * 0.85));
      } else {
        next += " ";
      }
    }
    return next.replace(/\s+$/g, "");
  });
}

function shadeCapMatrix(matrix: readonly string[]): string[] {
  const width = matrixWidth(matrix);
  const height = matrix.length;
  const padded = matrix.map((row) => row.padEnd(width));

  return padded.map((row, y) => {
    let next = "";
    const yNorm = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x++) {
      const current = sourceTone(row[x]);
      if (current <= 0) {
        next += " ";
        continue;
      }

      const xNorm = width <= 1 ? 0 : x / (width - 1);
      const crownHighlight = Math.max(0, 1 - Math.hypot((xNorm - 0.4) / 0.34, (yNorm - 0.28) / 0.36)) * 18;
      const frontBrimHighlight = yNorm > 0.54 ? Math.max(0, 1 - xNorm / 0.72) * 18 : 0;
      const seamX = (xNorm - 0.38) / 0.7;
      const seamY = 0.68 - Math.pow(seamX, 2) * 0.16 - xNorm * 0.015;
      const brimSeamHighlight = Math.abs(yNorm - seamY) < 0.032 && xNorm > 0.07 && xNorm < 0.76
        ? 34 * (1 - Math.max(0, xNorm - 0.52) / 0.24)
        : 0;
      const leftFalloff = (1 - xNorm) * 28;
      const rightPanelShadow = xNorm > 0.52 ? (xNorm - 0.52) * 110 : 0;
      const farRightEdgeShadow = xNorm > 0.74 ? (xNorm - 0.74) * 170 : 0;
      const lowerRightShadow = yNorm > 0.58 && xNorm > 0.46 ? 13 : 0;
      const topSoftening = yNorm < 0.12 ? 8 : 0;
      const tone = current * 0.45 + 9 + leftFalloff + crownHighlight + frontBrimHighlight + brimSeamHighlight - rightPanelShadow - farRightEdgeShadow - lowerRightShadow - topSoftening;
      next += encodeTone(tone);
    }
    return next.replace(/\s+$/g, "");
  });
}

function removeCapStrays(matrix: readonly string[]): string[] {
  const width = matrixWidth(matrix);
  const height = matrix.length;
  const padded = matrix.map((row) => row.padEnd(width));
  return padded.map((row, y) => {
    let next = "";
    const yNorm = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x++) {
      const current = sourceTone(row[x]);
      if (current <= 0) {
        next += " ";
        continue;
      }
      const xNorm = width <= 1 ? 0 : x / (width - 1);
      const neighbors = [
        padded[y - 1]?.[x - 1], padded[y - 1]?.[x], padded[y - 1]?.[x + 1],
        row[x - 1], row[x + 1],
        padded[y + 1]?.[x - 1], padded[y + 1]?.[x], padded[y + 1]?.[x + 1],
      ].filter((shade) => sourceTone(shade ?? " ") > 0).length;
      const lowerLeftSpeck =
        yNorm > 0.52 &&
        xNorm < 0.26 &&
        sourceTone(row[x - 1] ?? " ") === 0 &&
        sourceTone(row[x + 1] ?? " ") === 0 &&
        sourceTone(padded[y + 1]?.[x] ?? " ") === 0;
      next += (yNorm > 0.58 && xNorm < 0.2 && neighbors <= 1) || lowerLeftSpeck ? " " : row[x];
    }
    return next.replace(/\s+$/g, "");
  });
}

function sourceTone(shade: string): number {
  return decodeTone(shade);
}

async function chooseDripItem(emailArg?: string): Promise<DripSelection | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    render(h(StaticFallback));
    return { item: "hat", starMethod: "browser", email: emailArg };
  }

  let result: DripSelection | null = null;
  const instance = render(h(DripApp, {
    emailArg,
    onDone: (selection: DripSelection) => {
      result = selection;
    },
    onCancel: () => {
      result = null;
    },
  }));

  await instance.waitUntilExit();
  return result;
}

export function renderDripStore(): string {
  return `raindrop drip

baseball cap  200 left
umbrella       50 left`;
}

export async function cmdDrip(args: string[]): Promise<number> {
  const parsed = parseDripArgs(args);
  if (typeof parsed === "number") return parsed;
  const emailArg = normalizeEmailArg(parsed.email);
  if (emailArg === null) return 64;

  const selection = await chooseDripItem(emailArg);
  if (!selection) return abort();
  if (!selection.email) {
    console.error("email is required to claim drip; rerun in a terminal or pass --email EMAIL.");
    return 64;
  }

  const starMethod = await completeGitHubStar(selection.starMethod);
  const claim = await submitDripClaim({
    email: selection.email,
    item: selection.item,
    starMethod,
  });
  return printClaimResult(claim, selection, selection.email);
}
