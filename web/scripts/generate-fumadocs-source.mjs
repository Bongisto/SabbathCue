// @ts-check
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DOCS_DIR = join(WEB_ROOT, "content", "docs");
const SOURCE_DIR = join(WEB_ROOT, ".source");
const SOURCE_CONFIG = join(WEB_ROOT, "source.config.ts");

function toPosixPath(path) {
  return path.split(sep).join("/");
}

function quote(value) {
  return JSON.stringify(value);
}

async function walkDocs(dir = DOCS_DIR) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDocs(full)));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".mdx") || entry.name === "meta.json")) {
      files.push(toPosixPath(relative(DOCS_DIR, full)));
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function makeServerSource(metaFiles, docFiles) {
  let index = 0;
  const imports = [];
  const metaEntries = [];
  const docEntries = [];

  for (const file of metaFiles) {
    const id = `__fd_glob_${index++}`;
    imports.push(`import { default as ${id} } from "../content/docs/${file}?collection=docs"`);
    metaEntries.push(`${quote(file)}: ${id}`);
  }

  for (const file of docFiles) {
    const id = `__fd_glob_${index++}`;
    imports.push(`import * as ${id} from "../content/docs/${file}?collection=docs"`);
    docEntries.push(`${quote(file)}: ${id}`);
  }

  return `// @ts-nocheck
${imports.join("\n")}
import { server } from "fumadocs-mdx/runtime/server";
import type * as Config from "../source.config";

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {${metaEntries.join(", ")}}, {${docEntries.join(", ")}});
`;
}

function makeBrowserSource(docFiles) {
  const entries = docFiles
    .map(
      (file) =>
        `${quote(file)}: () => import("../content/docs/${file}?collection=docs")`,
    )
    .join(", ");

  return `// @ts-nocheck
import { browser } from "fumadocs-mdx/runtime/browser";
import type * as Config from "../source.config";

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {${entries}}),
};
export default browserCollections;
`;
}

function makeDynamicSource() {
  return `// @ts-nocheck
import { dynamic } from "fumadocs-mdx/runtime/dynamic";
import * as Config from "../source.config";

const create = await dynamic<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>(Config, {"configPath":"source.config.ts","environment":"next","outDir":".source"}, {"doc":{"passthroughs":["extractedReferences"]}});

export default create;
`;
}

export async function generateFumadocsSource() {
  const files = await walkDocs();
  const metaFiles = files.filter((file) => file.endsWith("meta.json"));
  const docFiles = files.filter((file) => file.endsWith(".mdx"));

  await mkdir(SOURCE_DIR, { recursive: true });
  await writeFile(join(SOURCE_DIR, "server.ts"), makeServerSource(metaFiles, docFiles));
  await writeFile(join(SOURCE_DIR, "browser.ts"), makeBrowserSource(docFiles));
  await writeFile(join(SOURCE_DIR, "dynamic.ts"), makeDynamicSource());

  // The current config is valid ESM as-is; copying it avoids Fumadocs' esbuild
  // config compilation path, which can walk above the workspace on Windows.
  await writeFile(join(SOURCE_DIR, "source.config.mjs"), await readFile(SOURCE_CONFIG, "utf8"));
  console.log(`[MDX] generated ${docFiles.length} docs and ${metaFiles.length} meta files`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  generateFumadocsSource().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
