import { readFileSync } from "node:fs"
import { join } from "node:path"

interface EgwSource {
  title: string
  abbreviation: string
  book_number: number
  chapters: Array<{
    chapter: number
    title: string
    paragraphs: Array<{
      paragraph: number
      page: number
      page_paragraph: number
      text: string
    }>
  }>
}

const FORBIDDEN_TEXT = [
  "Overview\n Great Controversy",
  "Read online\n Listen to audio book",
  "Site published by",
  "font-family:",
  "background-color:",
  "text-decoration:",
  "/* List Definitions */",
] as const

const EXPECTED = [
  {
    abbreviation: "PP",
    chapters: 73,
    file: "patriarchs-and-prophets.json",
  },
  {
    abbreviation: "SC",
    chapters: 13,
    file: "steps-to-christ.json",
  },
  {
    abbreviation: "DA",
    chapters: 87,
    file: "the-desire-of-ages.json",
  },
  {
    abbreviation: "Ed",
    chapters: 35,
    file: "education.json",
  },
  {
    abbreviation: "GC",
    chapters: 42,
    file: "the-great-controversy.json",
  },
] as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function titlePattern(title: string): string {
  return title
    .replace(/["']/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .map((part) => part.replace(/["']/g, `["']?`))
    .join("\\s+")
}

function looksLikePageNumberArtifact(
  text: string,
  bookTitle: string,
  chapterTitle: string,
  printedPage: number,
): boolean {
  const trimmed = text.trim()
  const pageNumber = "\\d{1,4}"
  const leadingNumber = trimmed.match(/^(\d{1,4})\s+/)
  const trailingNumber = trimmed.match(/\s+(\d{1,4})$/)
  const chapterPattern = titlePattern(chapterTitle)
  const bookPattern = titlePattern(bookTitle)
  const titleHeaderPatterns = [chapterPattern, bookPattern]
    .filter(Boolean)
    .map((pattern) => new RegExp(`\\b${pattern}\\s+${pageNumber}\\b`, "i"))

  return (
    (leadingNumber != null && Number(leadingNumber[1]) === printedPage) ||
    (trailingNumber != null && Number(trailingNumber[1]) === printedPage) ||
    titleHeaderPatterns.some((pattern) => pattern.test(trimmed))
  )
}

function main() {
  for (const book of EXPECTED) {
    const path = join(import.meta.dir, "sources", "egw", book.file)
    const source = JSON.parse(readFileSync(path, "utf8")) as EgwSource

    if (source.abbreviation !== book.abbreviation) {
      throw new Error(`Expected ${book.abbreviation} in ${book.file}`)
    }
    if (source.chapters.length !== book.chapters) {
      throw new Error(
        `${book.abbreviation}: expected ${book.chapters} chapters, got ${source.chapters.length}`,
      )
    }

    const pageParagraphs = new Set<string>()
    for (let i = 0; i < source.chapters.length; i += 1) {
      const chapter = source.chapters[i]
      if (chapter.chapter !== i + 1) {
        throw new Error(
          `${book.abbreviation}: chapter sequence broken at ${i + 1}`,
        )
      }
      if (chapter.paragraphs.length === 0) {
        throw new Error(`${book.abbreviation} ${chapter.chapter}: chapter is empty`)
      }
      for (let j = 0; j < chapter.paragraphs.length; j += 1) {
        const paragraph = chapter.paragraphs[j]
        if (paragraph.paragraph !== j + 1) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}: paragraph sequence broken at ${j + 1}`,
          )
        }
        if (!Number.isInteger(paragraph.page) || paragraph.page <= 0) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} is missing a printed page`,
          )
        }
        if (
          !Number.isInteger(paragraph.page_paragraph) ||
          paragraph.page_paragraph <= 0
        ) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} is missing a printed page paragraph`,
          )
        }
        const pageParagraphKey = `${paragraph.page}:${paragraph.page_paragraph}`
        if (pageParagraphs.has(pageParagraphKey)) {
          throw new Error(
            `${book.abbreviation} p.${paragraph.page} par.${paragraph.page_paragraph} is duplicated`,
          )
        }
        pageParagraphs.add(pageParagraphKey)
        if (!paragraph.text.trim()) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} is empty`,
          )
        }
        if (
          looksLikePageNumberArtifact(
            paragraph.text,
            source.title,
            chapter.title,
            paragraph.page,
          )
        ) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} appears to contain a PDF page number artifact`,
          )
        }
        for (const forbidden of FORBIDDEN_TEXT) {
          if (paragraph.text.includes(forbidden)) {
            throw new Error(
              `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} contains site chrome: ${JSON.stringify(forbidden)}`,
            )
          }
        }
      }
    }

    console.log(`${book.abbreviation}=${source.chapters.length}`)
  }
}

main()
