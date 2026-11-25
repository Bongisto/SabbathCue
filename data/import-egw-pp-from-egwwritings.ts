/**
 * One-shot importer for Ellen G. White's "Patriarchs and Prophets".
 *
 * Source note:
 * EGW Writings is the preferred canonical source, but it is currently blocked
 * behind a Cloudflare challenge for non-interactive clients in this environment.
 * This importer therefore uses ellenwhite.info, whose HTML preserves chapter
 * order and paragraph order in a stable, readable structure.
 *
 * Strategy:
 * 1. Fetch the online table of contents and discover the 73 numbered chapters.
 * 2. Fetch each chapter page in TOC order.
 * 3. Prefer structural HTML parsing using tag-level regexes over the chapter body.
 * 4. Fall back to rendered-text slicing if a chapter page is structurally inconsistent.
 * 5. Write final EGW JSON for build:egw import.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const TOC_URL = "https://www.ellenwhite.info/books/ellen-g-white-book-patriarchs-and-prophets-pp-contents.htm"
const DEBUG_DIR = join(import.meta.dir, "..", "tmp", "egw", "pp")
const RAW_DIR = join(DEBUG_DIR, "raw")
const TOC_DEBUG = join(DEBUG_DIR, "toc.html")
const CHAPTERS_DEBUG = join(DEBUG_DIR, "chapters.json")
const OUTPUT_JSON = join(import.meta.dir, "sources", "egw", "patriarchs-and-prophets.json")

const BOOK = {
  title: "Patriarchs and Prophets",
  abbreviation: "PP",
  book_number: 1,
} as const

type ChapterLink = {
  chapter: number
  title: string
  url: string
}

type OutputParagraph = {
  paragraph: number
  page: number
  page_paragraph: number
  text: string
}

type OutputChapter = {
  chapter: number
  title: string
  paragraphs: OutputParagraph[]
}

type PageTrackerState = {
  currentPage: number
  hasSeenPageMarker: boolean
  pageParagraphCounts: Map<number, number>
}

const PAGE_MARKER_REGEX = /\[p\.\s*(\d+)\]/gi
const LEADING_PAGE_MARKER_REGEX = /^\s*\[p\.\s*(\d+)\]/i

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u00ad/g, "")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ")
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function normalizeRawParagraph(text: string): string {
  return normalizeWhitespace(decodeHtmlEntities(stripTags(text)))
}

function stripPageMarkers(text: string): string {
  return text
    .replace(/\[p\.\s*\d+\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

function cleanParagraph(text: string): string {
  return stripPageMarkers(normalizeRawParagraph(text))
}

function extractPageMarkers(rawText: string): number[] {
  const pages: number[] = []
  for (const match of rawText.matchAll(PAGE_MARKER_REGEX)) {
    const page = Number(match[1])
    if (Number.isInteger(page) && page > 0) {
      pages.push(page)
    }
  }
  return pages
}

function assignParagraphPages(rawParagraphs: string[], state: PageTrackerState): OutputParagraph[] {
  const output: OutputParagraph[] = []

  for (const rawText of rawParagraphs) {
    const markers = extractPageMarkers(rawText)
    const leadingMatch = rawText.match(LEADING_PAGE_MARKER_REGEX)
    const leadingPage = leadingMatch ? Number(leadingMatch[1]) : null
    const cleaned = stripPageMarkers(rawText)

    if (leadingPage != null && Number.isInteger(leadingPage) && leadingPage > 0) {
      state.currentPage = leadingPage
      state.hasSeenPageMarker = true
    } else if (!state.hasSeenPageMarker && markers.length > 0) {
      state.currentPage = markers[0]
      state.hasSeenPageMarker = true
    }

    if (cleaned.length > 0) {
      const page = state.hasSeenPageMarker ? state.currentPage : 1
      const pageParagraph = (state.pageParagraphCounts.get(page) ?? 0) + 1
      state.pageParagraphCounts.set(page, pageParagraph)
      output.push({
        paragraph: output.length + 1,
        page,
        page_paragraph: pageParagraph,
        text: cleaned,
      })
    }

    if (markers.length > 0) {
      state.currentPage = markers[markers.length - 1]
      state.hasSeenPageMarker = true
    }
  }

  return output
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      referer: TOC_URL,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return await response.text()
}

function extractChapterLinks(tocHtml: string): ChapterLink[] {
  const chapterLinkRegex =
    /<a[^>]+href="([^"]*ellen-g-white-book-patriarchs-and-prophets-pp-(\d+)\.htm)"[^>]*>(.*?)<\/a>/gis
  const chapters: ChapterLink[] = []
  let match: RegExpExecArray | null

  while ((match = chapterLinkRegex.exec(tocHtml)) !== null) {
    const chapter = Number(match[2])
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 73) continue

    const title = cleanParagraph(match[3])
    if (!title) continue

    chapters.push({
      chapter,
      title,
      url: new URL(match[1], TOC_URL).toString(),
    })
  }

  const deduped = chapters.filter(
    (entry, index, entries) => entries.findIndex((candidate) => candidate.chapter === entry.chapter) === index,
  )

  deduped.sort((a, b) => a.chapter - b.chapter)

  if (deduped.length !== 73) {
    throw new Error(`Expected 73 chapter links, found ${deduped.length}`)
  }

  for (let i = 0; i < deduped.length; i += 1) {
    if (deduped[i].chapter !== i + 1) {
      throw new Error(`Chapter link sequence is broken at ${i + 1}`)
    }
  }

  return deduped
}

function isNoiseParagraph(text: string): boolean {
  if (!text) return true
  if (text === "Table of Contents") return true
  if (text.startsWith("Click here to read the next chapter:")) return true
  if (text.startsWith("Site published by")) return true
  if (text.startsWith("< Prev")) return true
  if (text.includes("special discount") && text.includes("Patriarchs and Prophets")) return true
  if (/^Chapters:\s*/i.test(text)) return true
  return false
}

function extractChapterHeading(html: string, chapter: number): { chapter: number; title: string; headingHtml: string } {
  const headingRegex = /<h3[^>]*>\s*Chapter\s+(\d+)\s*:\s*(.*?)<\/h3>/is
  const match = html.match(headingRegex)

  if (!match) {
    throw new Error(`Could not locate chapter heading for chapter ${chapter}`)
  }

  const parsedChapter = Number(match[1])
  const parsedTitle = cleanParagraph(match[2])

  if (parsedChapter !== chapter) {
    throw new Error(`Heading chapter mismatch: expected ${chapter}, got ${parsedChapter}`)
  }

  return {
    chapter: parsedChapter,
    title: parsedTitle,
    headingHtml: match[0],
  }
}

function extractParagraphsStructurally(html: string, headingHtml: string): string[] {
  const startIndex = html.indexOf(headingHtml)
  if (startIndex === -1) return []

  let rest = html.slice(startIndex + headingHtml.length)
  const stopMarkers = [
    /Click here to read the next chapter:/i,
    /<hr\b/i,
    /<table[^>]*class="[^"]*donotprint/i,
    /Site published by/gi,
  ]

  for (const marker of stopMarkers) {
    const markerMatch = rest.match(marker)
    if (markerMatch && markerMatch.index != null) {
      rest = rest.slice(0, markerMatch.index)
    }
  }

  rest = rest
    .replace(/<p>\s*<table[\s\S]*?Illustration[\s\S]*?<\/table>\s*/gi, "")
    .replace(/<table[^>]*class="[^"]*adtablecontainer[^"]*"[\s\S]*?<\/table>\s*/gi, "")
    .replace(/<table[^>]*class="[^"]*donotprint[^"]*"[\s\S]*?<\/table>\s*/gi, "")

  const paragraphRegex = /<(p|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi
  const paragraphs: string[] = []
  let match: RegExpExecArray | null

  while ((match = paragraphRegex.exec(rest)) !== null) {
    const rawBlock = match[2]
    if (
      /<img\b/i.test(rawBlock) ||
      /class="[^"]*(caption|obimage|adtext|donotprint)[^"]*"/i.test(rawBlock)
    ) {
      continue
    }

    const rawText = normalizeRawParagraph(rawBlock)
    const cleaned = stripPageMarkers(rawText)
    const hasMarker = extractPageMarkers(rawText).length > 0
    if (hasMarker || (cleaned.length > 0 && !isNoiseParagraph(cleaned))) {
      paragraphs.push(rawText)
    }
  }

  return paragraphs
}

function extractParagraphsFromRenderedText(html: string, chapter: number, title: string): string[] {
  const bodyText = normalizeWhitespace(decodeHtmlEntities(stripTags(html)))
  const headingPattern = new RegExp(`Chapter\\s+${chapter}\\s*:\\s*${escapeRegExp(title)}`, "i")
  const headingMatch = bodyText.match(headingPattern)

  if (!headingMatch || headingMatch.index == null) {
    throw new Error(`Missing heading in fallback extraction for chapter ${chapter}`)
  }

  const start = headingMatch.index + headingMatch[0].length
  let rest = bodyText.slice(start)
  const stopMarkers = [
    "Click here to read the next chapter:",
    "Table of Contents Chapters:",
    "Site published by",
  ]

  for (const marker of stopMarkers) {
    const markerIndex = rest.indexOf(marker)
    if (markerIndex !== -1) {
      rest = rest.slice(0, markerIndex)
    }
  }

  return rest
    .split(/\n\s*\n/g)
    .map((paragraph) => normalizeRawParagraph(paragraph))
    .filter((rawText) => {
      const cleaned = stripPageMarkers(rawText)
      return extractPageMarkers(rawText).length > 0 || (cleaned.length > 0 && !isNoiseParagraph(cleaned))
    })
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractChapterFromHtml(
  link: ChapterLink,
  html: string,
  pageState: PageTrackerState,
): OutputChapter {
  const heading = extractChapterHeading(html, link.chapter)
  const structuralRaw = extractParagraphsStructurally(html, heading.headingHtml)
  const hasStructuralProse = structuralRaw.some((rawText) => stripPageMarkers(rawText).length > 0)
  const rawParagraphs = hasStructuralProse
    ? structuralRaw
    : extractParagraphsFromRenderedText(html, link.chapter, heading.title)

  const paragraphs = assignParagraphPages(rawParagraphs, pageState)

  if (paragraphs.length === 0) {
    throw new Error(`No paragraphs extracted for chapter ${link.chapter}`)
  }

  return {
    chapter: link.chapter,
    title: heading.title,
    paragraphs,
  }
}

async function main() {
  mkdirSync(DEBUG_DIR, { recursive: true })
  mkdirSync(RAW_DIR, { recursive: true })
  mkdirSync(dirname(OUTPUT_JSON), { recursive: true })

  const tocHtml = await fetchText(TOC_URL)
  writeFileSync(TOC_DEBUG, tocHtml)

  const links = extractChapterLinks(tocHtml)
  const chapters: OutputChapter[] = []
  const pageState: PageTrackerState = {
    currentPage: 1,
    hasSeenPageMarker: false,
    pageParagraphCounts: new Map<number, number>(),
  }

  for (const link of links) {
    const html = await fetchText(link.url)
    writeFileSync(join(RAW_DIR, `chapter-${link.chapter}.html`), html)
    chapters.push(extractChapterFromHtml(link, html, pageState))
  }

  const output = {
    title: BOOK.title,
    abbreviation: BOOK.abbreviation,
    book_number: BOOK.book_number,
    chapters,
  }

  writeFileSync(CHAPTERS_DEBUG, `${JSON.stringify(chapters, null, 2)}\n`)
  writeFileSync(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`)

  const totalParagraphs = chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0)
  console.log(`Imported ${chapters.length} chapters and ${totalParagraphs} paragraphs.`)
  console.log(`Wrote JSON to ${OUTPUT_JSON}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
