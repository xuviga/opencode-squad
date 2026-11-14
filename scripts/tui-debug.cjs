const pty = require("node-pty");

const cwd = "D:/codex/opencode-squad/dev";
const term = pty.spawn("C:/ProgramData/chocolatey/bin/opencode.exe", ["--log-level", "debug", "--print-logs"], {
  name: "xterm-256color",
  cols: 120,
  rows: 40,
  cwd,
  env: { ...process.env, TERM: "xterm-256color" },
});

let output = "";
term.onData((data) => {
  output += data;
});
term.onExit(() => {
  process.exit(0);
});

setTimeout(() => {
  term.write("\u0003");
}, 12000);
setTimeout(() => {
  term.kill();
  const stripped = output
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  const lines = stripped.split(/\r?\n/).filter((line) => /plugin|squad|tui|error/i.test(line));
  console.log(lines.slice(-120).join("\n"));
  process.exit(0);
}, 15000);
