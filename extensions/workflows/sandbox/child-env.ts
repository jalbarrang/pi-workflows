/**
 * Environment forwarded to the sandbox child.
 *
 * The tight env is a security property, so this forwards the minimum a Node
 * child needs to start and nothing else. Two Windows-only facts drive the extra
 * handling: the PATH variable is conventionally spelled `Path`, so a hardcoded
 * `PATH` key hands the child an empty search path, and Windows Node needs
 * `SystemRoot` during initialization.
 */
const WINDOWS_REQUIRED_KEYS = ["SystemRoot", "SYSTEMROOT", "TEMP", "TMP"] as const;

export function resolvePathKey(env: NodeJS.ProcessEnv) {
  return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
}

export function buildChildEnv(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const pathKey = resolvePathKey(env);
  const childEnv: NodeJS.ProcessEnv = {
    [pathKey]: env[pathKey] ?? "",
    NODE_NO_WARNINGS: "1",
  };
  if (platform !== "win32") return childEnv;
  for (const key of WINDOWS_REQUIRED_KEYS) {
    const value = env[key];
    if (value !== undefined) childEnv[key] = value;
  }
  return childEnv;
}
