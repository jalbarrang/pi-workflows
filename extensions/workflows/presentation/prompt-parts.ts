/** Join prose fragments with spaces; join code fragments without them. */
export const prose = (...parts: string[]) => parts.join(" ");
export const code = (...parts: string[]) => parts.join("");
