import * as os from "node:os";

export const shortenHome = (value: string) => {
  const home = os.homedir();
  return value.startsWith(home) ? `~${value.slice(home.length)}` : value;
};
