import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { cleanEgwParagraphs } from "./lib/egw-text-cleanup"

interface EgwSource {
  title: string
  abbreviation: string
  book_number: number
  chapters: Array<{
    chapter: number
    title: string
    paragraphs: Array<{ paragraph: number; text: string }>
  }>
}

const EGW_DIR = join(import.meta.dir, "sources", "egw")

const FILES = [
  "patriarchs-and-prophets.json",
  "steps-to-christ.json",
  "the-desire-of-ages.json",
] as const

function repairSource(path: string): void {
  const source = JSON.parse(readFileSync(path, "utf8")) as EgwSource
  const before = source.chapters.reduce(
    (sum, chapter) => sum + chapter.paragraphs.length,
    0,
  )

  source.chapters = source.chapters.map((chapter) => ({
    ...chapter,
    paragraphs: cleanEgwParagraphs(chapter.paragraphs, {
      bookTitle: source.title,
      chapterTitle: chapter.title,
    }),
  }))

  const after = source.chapters.reduce(
    (sum, chapter) => sum + chapter.paragraphs.length,
    0,
  )

  writeFileSync(path, `${JSON.stringify(source, null, 2)}\n`)
  console.log(
    `${source.abbreviation}: ${before.toLocaleString()} -> ${after.toLocaleString()} paragraphs`,
  )
}

for (const file of FILES) {
  repairSource(join(EGW_DIR, file))
}
