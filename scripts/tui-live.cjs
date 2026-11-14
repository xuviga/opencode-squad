const pty = require("node-pty");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// node-pty forks a console-list agent on exit; on this Windows host it fails
// with AttachConsole and crashes the driver. An empty list is enough here.
try {
  const { WindowsPtyAgent } = require("node-pty/lib/windowsPtyAgent");
  WindowsPtyAgent.prototype._getConsoleProcessList = () => Promise.resolve([]);
} catch {
  // keep the default behaviour if the internal module changes
}

const cwd = "D:/codex/opencode-squad";
const dev = path.join(cwd, "dev");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const strip = (text) =>
  text
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");

const missionID = execFileSync("bun", ["run", "scripts/tui-fixture.ts"], {
  cwd,
  encoding: "utf8",
}).trim();
const sessionID = execFileSync("bun", ["run", "scripts/tui-session.ts"], {
  cwd,
  encoding: "utf8",
}).trim();

function status() {
  return execFileSync("bun", ["run", "scripts/tui-status.ts", missionID], {
    cwd,
    encoding: "utf8",
  }).trim();
}

const term = pty.spawn("C:/ProgramData/chocolatey/bin/opencode.exe", ["--standalone", "--session", sessionID], {
  name: "xterm-256color",
  cols: 120,
  rows: 40,
  cwd: dev,
  env: { ...process.env, TERM: "xterm-256color" },
});

let output = "";
let exited = false;
term.onData((data) => {
  output += data;
});
term.onExit(() => {
  exited = true;
});

async function waitFor(predicate, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    if (exited) throw new Error(`TUI exited while waiting for ${label}`);
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function main() {
  await waitFor(() => strip(output).includes("SQUAD TUI live") || strip(output).includes("ctrl+p commands"), 30_000, "session");
  term.write("/squad");
  await sleep(900);
  term.write("\r");
  await waitFor(() => strip(output).includes("TUI live gate"), 30_000, "SQUAD panel");

  const before = status();
  term.write("r");
  await sleep(2500);
  const afterReject = status();

  execFileSync("bun", ["run", "scripts/tui-resubmit.ts", missionID], {
    cwd,
    encoding: "utf8",
  });
  await sleep(2500);
  const resubmitted = status();

  term.write("a");
  await sleep(2500);
  const afterApprove = status();

  term.write("\u001b");
  await sleep(300);
  term.write("\u0003");
  await sleep(500);
  term.write("\u0003");

  const frame = strip(output);
  fs.writeFileSync(path.join(dev, "tui-live.log"), frame, "utf8");

  const result = {
    missionID,
    before,
    afterReject,
    resubmitted,
    afterApprove,
    panelSeen: frame.includes("SQUAD"),
    missionSeen: frame.includes("TUI live gate"),
  };
  console.log(JSON.stringify(result, null, 2));

  if (before !== "plan_gate" || afterReject !== "draft" || afterApprove !== "staffing") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("TUI live failed:", error.message);
    console.error(strip(output).slice(-4000));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sleep(500);
    try {
      term.kill();
    } catch {
      // already exited
    }
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  });
