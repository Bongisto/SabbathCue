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
    paragraphs: Array<{
      paragraph: number
      page?: number
      page_paragraph?: number
      text: string
    }>
  }>
}

const EGW_DIR = join(import.meta.dir, "sources", "egw")

const FILES = [
  "patriarchs-and-prophets.json",
  "steps-to-christ.json",
  "the-desire-of-ages.json",
  "education.json",
  "the-great-controversy.json",
] as const

function assignPageParagraphs(source: EgwSource): EgwSource {
  const countsByPage = new Map<number, number>()
  return {
    ...source,
    chapters: source.chapters.map((chapter) => ({
      ...chapter,
      paragraphs: chapter.paragraphs.map((paragraph) => {
        if (paragraph.page == null) return paragraph
        const pageParagraph = (countsByPage.get(paragraph.page) ?? 0) + 1
        countsByPage.set(paragraph.page, pageParagraph)
        return { ...paragraph, page_paragraph: pageParagraph }
      }),
    })),
  }
}

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
  const repaired = assignPageParagraphs(source)

  const after = repaired.chapters.reduce(
    (sum, chapter) => sum + chapter.paragraphs.length,
    0,
  )

  writeFileSync(path, `${JSON.stringify(repaired, null, 2)}\n`)
  console.log(
    `${repaired.abbreviation}: ${before.toLocaleString()} -> ${after.toLocaleString()} paragraphs`,
  )
}

for (const file of FILES) {
  repairSource(join(EGW_DIR, file))
}
