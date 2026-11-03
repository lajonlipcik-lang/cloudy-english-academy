import { readFile } from "node:fs/promises";

const file = new URL("../public/cloudy-english.html", import.meta.url);
const html = await readFile(file, "utf8");
const inlineScripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
  .filter((match) => !/\\bsrc\\s*=/.test(match[1]) && match[2].trim());

if (inlineScripts.length === 0) {
  throw new Error("No inline JavaScript found in public/cloudy-english.html");
}

for (const [index, match] of inlineScripts.entries()) {
  try {
    // Compile only: this validates browser script syntax without executing browser APIs.
    new Function(match[2]);
  } catch (error) {
    throw new SyntaxError(`Inline script ${index + 1} in public/cloudy-english.html is invalid: ${error.message}`);
  }
}

console.log(`Validated syntax for ${inlineScripts.length} inline script(s) in public/cloudy-english.html`);
