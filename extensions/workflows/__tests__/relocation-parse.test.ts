import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRelocation } from "../policy/index.ts";

test("the relocation parser refuses anything that could hide a second command", () => {
  const attempts = [
    "git mv client/a client/b && rm -rf .",
    "git mv client/a client/b; rm -rf .",
    "git mv client/a client/b | tee /etc/x",
    "git mv client/a $(echo client/b)",
    "git mv client/a `echo client/b`",
    "git mv client/a client/b > /etc/x",
    "git mv 'client/a b' client/c",
    "git mv client/* client/b",
    "git mv -f client/a client/b",
    "git mv --force client/a client/b",
    "git mv client/a client/b client/c",
    "git mv client/a",
    "git\tmv client/a client/b\nrm -rf .",
    "git commit -m x",
  ];
  for (const command of attempts) {
    assert.equal(parseRelocation(command).request, undefined, `parsed ${command}`);
  }
  assert.deepEqual(parseRelocation("git mv -n client/a client/b").request, {
    verb: "git mv",
    paths: ["client/a", "client/b"],
  });
});

test("a rejected relocation names the flag instead of refusing generically", () => {
  for (const flag of ["-f", "--force", "-k"]) {
    const reason = parseRelocation(`git mv ${flag} client/a client/b`).reason ?? "";
    assert.match(reason, new RegExp(`flag "${flag}" is not permitted`));
    assert.match(reason, /Permitted flags: -v, -n/);
  }
  assert.match(
    parseRelocation("git mv client/a client/b client/c").reason ?? "",
    /exactly two paths/,
  );
  assert.match(parseRelocation("git mv client/a client/b && rm -rf .").reason ?? "", /no pipes/);
});
