const pty = require("node-pty");
const path = require("node:path");

const cwd = "D:/codex/opencode-squad/dev";
const term = pty.spawn("C:/ProgramData/chocolatey/bin/opencode.exe", [], {
  name: "xterm-256color",
  cols: 120,
  rows: 40,
  cwd,
  env: { ...process.env, TERM: "xterm-256color" },
});

let output = "";
term.onData((data) => {
  output += data;
  process.stdout.write(data);
});
term.onExit(({ exitCode }) => {
  console.log("\n[exit]", exitCode);
  process.exit(0);
});

setTimeout(() => {
  term.write("\u0003");
}, 8000);

setTimeout(() => {
  console.log("\n[timeout] bytes", output.length);
  term.kill();
  process.exit(0);
}, 15000);
