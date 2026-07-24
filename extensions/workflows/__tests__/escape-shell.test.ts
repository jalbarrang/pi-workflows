import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCommand } from "../policy/index.ts";

/** Patterns wide enough that only the destructive list can stop these. */
const WIDE = ["npm *", "dotnet *", "git *", "node *", "sh *", "bash *"];

test("re-entering a shell cannot launder a denied command", () => {
  for (const command of [
    "sh -c 'echo x > f'",
    "bash -c 'rm -rf .'",
    "sh -c 'npm run build'",
    "env sh -c 'rm -rf .'",
    "xargs rm -rf",
  ]) {
    assert.equal(checkCommand(command, WIDE).allowed, false, `allowed ${command}`);
  }
});

test("PowerShell cannot be used to escape a POSIX-parsed policy", () => {
  // The bash->PowerShell hop is the one real cross-platform escape hatch, since
  // shell-quote cannot parse PowerShell syntax. It must stay closed.
  for (const command of [
    "powershell.exe -Command 'rm -rf .'",
    "powershell -NoProfile -Command x",
    "pwsh -c x",
    "PWSH -c x",
  ]) {
    assert.equal(checkCommand(command, WIDE).allowed, false, `allowed ${command}`);
  }
});

test("interpreters that can execute arbitrary code are denied", () => {
  for (const command of [
    "node -e 'require(1)'",
    "node --eval x",
    "python -c 'import os'",
    "python3 -c x",
    "perl -e x",
    "eval rm -rf .",
  ]) {
    assert.equal(checkCommand(command, WIDE).allowed, false, `allowed ${command}`);
  }
});

test("every segment of a chained command must pass independently", () => {
  const allow = ["npm *"];
  for (const command of [
    "npm test && rm -rf x",
    "npm test; rm -rf x",
    "npm test || rm -rf x",
    "npm test | rm -rf x",
    "rm -rf x && npm test",
    "(npm test && rm -rf x)",
  ]) {
    assert.equal(checkCommand(command, allow).allowed, false, `allowed ${command}`);
  }
  assert.equal(checkCommand("npm test", allow).allowed, true);
});

test("redirects and command substitution stay blocked under any allowlist", () => {
  for (const command of [
    "npm test > out.txt",
    "npm test >> out.txt",
    "npm test 2> err.txt",
    "$(rm -rf x)",
    "npm test $(rm -rf x)",
    "echo `rm -rf x`",
  ]) {
    assert.equal(checkCommand(command, WIDE).allowed, false, `allowed ${command}`);
  }
});

test("allowCommands cannot be widened into allow-everything", () => {
  for (const pattern of ["*", "**", "", "   ", "* *", "***"]) {
    const decision = checkCommand("rm -rf /", [pattern]);
    assert.equal(decision.allowed, false, `pattern ${JSON.stringify(pattern)} allowed rm -rf`);
    assert.match(decision.reason ?? "", /empty|would allow every command/);
  }
});
