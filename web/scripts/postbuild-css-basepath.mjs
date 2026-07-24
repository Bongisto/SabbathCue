// @ts-check
// Post-build fixup for basePath in CSS.
//
// Next prefixes routes and next/image with basePath automatically, but it
// never rewrites url() values inside CSS. globals.css therefore authors font
// URLs as root-relative (/fonts/...), which is already correct for the Vercel
// root deploy; GitHub Pages serves the same files under /SabbathCue/ and needs
// the prefix added here.
//
// Getting this wrong is silent: the page still renders, just in a fallback
// font, which is how /SabbathCue/fonts/*.woff2 shipped to Vercel 404ing.
//
// basePath is read back out of the emitted HTML rather than from the
// environment on purpose. next build loads .env.local / .env.production.local
// (which disagree: "/SabbathCue" vs ""), a plain node script does not, so
// re-deriving it from process.env here would prefix the wrong builds.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = fileURLToPath(new URL("../out/", import.meta.url));

/** Recovers the basePath Next actually used from an asset URL it wrote. */
async function detectBasePath() {
  const indexHtml = join(OUT_DIR, "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error("out/index.html missing — run this after next build");
  }
  const html = await readFile(indexHtml, "utf8");
  const match = html.match(/(?:href|src)="([^"]*)\/_next\//);
  if (!match) {
    throw new Error("no /_next/ asset URL in out/index.html to read basePath from");
  }
  return match[1];
}

/**
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walkCss(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkCss(full);
    else if (entry.isFile() && entry.name.endsWith(".css")) yield full;
  }
}

async function main() {
  const basePath = await detectBasePath();
  if (!basePath) {
    console.log("css basepath: root deploy, no prefix needed");
    return;
  }

  // Anchored on url( so it cannot match an already-prefixed
  // url("/SabbathCue/fonts/...) — re-running is a no-op. Scoped to /fonts/ so
  // data: URIs, absolute URLs and /_next/ paths are left alone.
  const re = /url\((["']?)\/fonts\//g;
  let touched = 0;
  for await (const file of walkCss(OUT_DIR)) {
    const original = await readFile(file, "utf8");
    const next = original.replace(re, `url($1${basePath}/fonts/`);
    if (next !== original) {
      await writeFile(file, next);
      touched++;
    }
  }

  console.log(`css basepath: prefixed /fonts/ with ${basePath} in ${touched} file(s)`);
}

await main();
