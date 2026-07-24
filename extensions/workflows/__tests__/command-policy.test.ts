import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCommand, compileAllowPattern } from "../policy/index.ts";

test("read-only exploration commands pass with no allowCommands", () => {
  for (const command of ["git diff", "git status", "rg foo", "cat src/index.ts", "ls -la"]) {
    assert.equal(checkCommand(command).allowed, true, `denied ${command}`);
  }
});

test("verification gates are denied until allowCommands widens the policy", () => {
  assert.equal(checkCommand("npm run build").allowed, false);
  assert.equal(checkCommand("dotnet test").allowed, false);
  assert.equal(checkCommand("npm run build", ["npm run *"]).allowed, true);
  assert.equal(checkCommand("npm run test:typecheck", ["npm run *"]).allowed, true);
  assert.equal(checkCommand("dotnet build cli/venus.sln", ["dotnet *"]).allowed, true);
});

test("allowCommands cannot re-enable destructive or shell-escaping commands", () => {
  const wide = ["npm *", "dotnet *", "git *"];
  for (const command of [
    "powershell.exe -Command x",
    "pwsh -c x",
    "sh -c 'echo x > f'",
    "bash -c 'rm -rf .'",
    "node -e 'require(1)'",
    "rm -rf /",
    "git commit -m x",
  ]) {
    assert.equal(checkCommand(command, wide).allowed, false, `allowed ${command}`);
  }
});

test("chaining, redirects, and substitution are denied segment by segment", () => {
  const allow = ["npm *"];
  assert.equal(checkCommand("npm test && rm -rf x", allow).allowed, false);
  assert.equal(checkCommand("npm test > out.txt", allow).allowed, false);
  assert.equal(checkCommand("$(rm -rf x)", allow).allowed, false);
  assert.equal(checkCommand("npm test | rm -rf x", allow).allowed, false);
});

test("allow-everything patterns are rejected instead of silently widening", () => {
  for (const pattern of ["*", "**", "  ", "* *"]) {
    assert.throws(() => compileAllowPattern(pattern), /empty|would allow every command/);
    const decision = checkCommand("rm -rf /", [pattern]);
    assert.equal(decision.allowed, false);
  }
});

test("a glob matches within one argument and only spans the tail when trailing", () => {
  assert.ok(compileAllowPattern("npm run *").test("npm run build"));
  assert.ok(compileAllowPattern("npm run *").test("npm run build --if-present"));
  assert.equal(compileAllowPattern("npm run test:*").test("npm run build"), false);
  assert.equal(compileAllowPattern("dotnet build").test("dotnet build extra"), false);
});
