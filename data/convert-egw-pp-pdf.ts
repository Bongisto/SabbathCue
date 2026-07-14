import { join } from "node:path"
import {
  importEgwPdf,
  type EgwBookConfig,
  type EgwDraftChapter,
} from "./lib/egw-pdf-importer"

const CHAPTERS = [
  { chapter: 1, title: "Why was Sin Permitted?" },
  { chapter: 2, title: "The Creation" },
  { chapter: 3, title: "The Temptation and Fall" },
  { chapter: 4, title: "The Plan of Redemption" },
  { chapter: 5, title: "Cain and Abel Tested" },
  { chapter: 6, title: "Seth and Enoch" },
  { chapter: 7, title: "The Flood" },
  { chapter: 8, title: "After the Flood" },
  { chapter: 9, title: "The Literal Week" },
  { chapter: 10, title: "The Tower of Babel" },
  { chapter: 11, title: "The Call of Abraham" },
  { chapter: 12, title: "Abraham in Canaan" },
  { chapter: 13, title: "The Test of Faith" },
  { chapter: 14, title: "Destruction of Sodom" },
  { chapter: 15, title: "The Marriage of Isaac" },
  { chapter: 16, title: "Jacob and Esau" },
  { chapter: 17, title: "Jacob's Flight and Exile" },
  { chapter: 18, title: "The Night of Wrestling" },
  { chapter: 19, title: "The Return to Canaan" },
  { chapter: 20, title: "Joseph in Egypt" },
  { chapter: 21, title: "Joseph and His Brothers" },
  { chapter: 22, title: "Moses" },
  { chapter: 23, title: "The Plagues of Egypt" },
  { chapter: 24, title: "The Passover" },
  { chapter: 25, title: "The Exodus" },
  { chapter: 26, title: "From the Red Sea to Sinai" },
  { chapter: 27, title: "The Law Given to Israel" },
  { chapter: 28, title: "Idolatry at Sinai" },
  { chapter: 29, title: "Satan's Enmity Against the Law" },
  { chapter: 30, title: "The Tabernacle and Its Services" },
  { chapter: 31, title: "The Sin of Nadab and Abihu" },
  { chapter: 32, title: "The Law and the Covenants" },
  { chapter: 33, title: "From Sinai to Kadesh" },
  { chapter: 34, title: "The Twelve Spies" },
  { chapter: 35, title: "The Rebellion of Korah" },
  { chapter: 36, title: "In the Wilderness" },
  { chapter: 37, title: "The Smitten Rock" },
  { chapter: 38, title: "The Journey Around Edom" },
  { chapter: 39, title: "The Conquest of Bashan" },
  { chapter: 40, title: "Balaam" },
  { chapter: 41, title: "Apostasy at the Jordan" },
  { chapter: 42, title: "The Law Repeated" },
  { chapter: 43, title: "The Death of Moses" },
  { chapter: 44, title: "Crossing the Jordan" },
  { chapter: 45, title: "The Fall of Jericho" },
  { chapter: 46, title: "The Blessings and the Curses" },
  { chapter: 47, title: "League With the Gibeonites" },
  { chapter: 48, title: "The Division of Canaan" },
  { chapter: 49, title: "The Last Words of Joshua" },
  { chapter: 50, title: "Tithes and Offerings" },
  { chapter: 51, title: "God's Care for the Poor" },
  { chapter: 52, title: "The Annual Feasts" },
  { chapter: 53, title: "The Earlier Judges" },
  { chapter: 54, title: "Samson" },
  { chapter: 55, title: "The Child Samuel" },
  { chapter: 56, title: "Eli and His Sons" },
  { chapter: 57, title: "The Ark Taken by the Philistines" },
  { chapter: 58, title: "The Schools of the Prophets" },
  { chapter: 59, title: "The First King of Israel" },
  { chapter: 60, title: "The Presumption of Saul" },
  { chapter: 61, title: "Saul Rejected" },
  { chapter: 62, title: "The Anointing of David" },
  { chapter: 63, title: "David and Goliath" },
  { chapter: 64, title: "David a Fugitive" },
  { chapter: 65, title: "The Magnanimity of David" },
  { chapter: 66, title: "The Death of Saul" },
  { chapter: 67, title: "Ancient and Modern Sorcery" },
  { chapter: 68, title: "David at Ziklag" },
  { chapter: 69, title: "David Called to the Throne" },
  { chapter: 70, title: "The Reign of David" },
  { chapter: 71, title: "David's Sin and Repentance" },
  { chapter: 72, title: "The Rebellion of Absalom" },
  { chapter: 73, title: "The Last Years of David" },
] as const

const inputPdf =
  process.argv[2] ?? String.raw`C:\Users\fanel\Downloads\en_PP (2).pdf`

type PpParagraph = EgwDraftChapter["paragraphs"][number]

function normalizeJoinedText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

function renumberChapter(chapter: EgwDraftChapter): EgwDraftChapter {
  return {
    ...chapter,
    paragraphs: chapter.paragraphs.map((paragraph, index) => ({
      ...paragraph,
      paragraph: index + 1,
    })),
  }
}

function mergeParagraphs(paragraphs: PpParagraph[]): PpParagraph {
  const [first] = paragraphs
  if (!first) {
    throw new Error("Cannot merge an empty Patriarchs and Prophets range")
  }

  const continuedPages = paragraphs.flatMap((paragraph) => [
    ...(paragraph.page != null && paragraph.page !== first.page
      ? [paragraph.page]
      : []),
    ...(paragraph.continued_pages ?? []),
  ])

  return {
    paragraph: first.paragraph,
    page: first.page,
    continued_pages:
      continuedPages.length > 0
        ? Array.from(new Set(continuedPages))
        : undefined,
    text: normalizeJoinedText(
      paragraphs.map((paragraph) => paragraph.text).join(" ")
    ),
  }
}

function alignChapter1CanonicalParagraphs(
  chapter: EgwDraftChapter
): EgwDraftChapter {
  if (chapter.chapter !== 1) return chapter

  const paragraphs = chapter.paragraphs
  // Canonical PP 33.2 is the whole psalm quotation plus its R.V. note as one
  // paragraph; the PDF sets each verse line apart, so merge the range by its
  // text bounds rather than fixed indices (upstream cleanup can change how
  // many pieces the psalm arrives in).
  const start = paragraphs.findIndex((paragraph) =>
    paragraph.text.startsWith('"Strong is Thy hand')
  )
  const end = paragraphs.findIndex((paragraph) =>
    paragraph.text.endsWith("Version.]")
  )
  const expectedOpening =
    paragraphs[0]?.text.startsWith('"God is love."') === true &&
    paragraphs[1]?.text.startsWith("Every manifestation") === true &&
    start >= 2 &&
    end >= start &&
    paragraphs[end + 1]?.text.startsWith(
      "The history of the great conflict"
    ) === true

  if (!expectedOpening) {
    throw new Error(
      "Unexpected Patriarchs and Prophets chapter 1 opening layout; canonical postprocess needs review."
    )
  }

  const aligned = [
    ...paragraphs.slice(0, start),
    mergeParagraphs(paragraphs.slice(start, end + 1)),
    ...paragraphs.slice(end + 1),
  ]

  return renumberChapter({ ...chapter, paragraphs: aligned })
}

// PP 556-557: Hannah's song is one poetry block introduced by "…and said:".
// The PDF sets each verse line apart; merge the block by its text bounds.
function alignChapter55HannahSong(chapter: EgwDraftChapter): EgwDraftChapter {
  if (chapter.chapter !== 55) return chapter

  const paragraphs = chapter.paragraphs
  const start = paragraphs.findIndex((paragraph) =>
    paragraph.text.startsWith('"My heart rejoiceth in the Lord;')
  )
  const end = paragraphs.findIndex((paragraph) =>
    paragraph.text.endsWith('exalt the horn of His anointed."')
  )

  if (start === -1) {
    if (
      paragraphs.some((paragraph) =>
        paragraph.text.includes('"My heart rejoiceth in the Lord;')
      )
    ) {
      return chapter
    }
    throw new Error(
      "Unexpected Patriarchs and Prophets chapter 55 song layout; canonical postprocess needs review."
    )
  }
  if (end < start) {
    throw new Error(
      "Unexpected Patriarchs and Prophets chapter 55 song layout; canonical postprocess needs review."
    )
  }

  const aligned = [
    ...paragraphs.slice(0, start),
    mergeParagraphs(paragraphs.slice(start, end + 1)),
    ...paragraphs.slice(end + 1),
  ]

  return renumberChapter({ ...chapter, paragraphs: aligned })
}

// PP 662: Michal's taunt belongs to the paragraph that introduces it —
// "Keen and cutting was the irony of her speech:" continues into the quote.
function alignChapter70MichalSpeech(chapter: EgwDraftChapter): EgwDraftChapter {
  if (chapter.chapter !== 70) return chapter

  const aligned: PpParagraph[] = []
  for (let index = 0; index < chapter.paragraphs.length; index += 1) {
    const current = chapter.paragraphs[index]
    const next = chapter.paragraphs[index + 1]

    if (
      current?.text.endsWith("irony of her speech:") &&
      next?.text.startsWith('"How glorious was the king of Israel')
    ) {
      aligned.push(mergeParagraphs([current, next]))
      index += 1
      continue
    }

    if (current) aligned.push(current)
  }

  return renumberChapter({ ...chapter, paragraphs: aligned })
}

function alignPatriarchsAndProphetsCanonicalParagraphs(
  chapters: EgwDraftChapter[]
): EgwDraftChapter[] {
  return chapters.map((chapter) =>
    alignChapter70MichalSpeech(
      alignChapter55HannahSong(alignChapter1CanonicalParagraphs(chapter))
    )
  )
}

const config: EgwBookConfig = {
  title: "Patriarchs and Prophets",
  abbreviation: "PP",
  book_number: 1,
  chapterAnchorTemplate: "Chapter {chapter}—{title}",
  expectedChapterCount: 73,
  pdfPath: inputPdf,
  outputJsonPath: join(
    import.meta.dir,
    "sources",
    "egw",
    "patriarchs-and-prophets.json"
  ),
  debugSlug: "en_PP",
  pageSource: "folios",
  requiredTokens: ["Contents", "Chapter 1—Why was Sin Permitted?", "Appendix"],
  appendixMarker: "Appendix [",
  splitReadableParagraphs: false,
  countContinuedPagesForPageParagraphs: false,
  postprocessChapters: alignPatriarchsAndProphetsCanonicalParagraphs,
  chapters: CHAPTERS,
}

async function main() {
  await importEgwPdf(config)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
