/**
 * Quick Search Utility Functions
 * Pure functions for Bible reference autocomplete logic
 */

export interface Book {
  id: number
  translation_id: number
  book_number: number
  name: string
  abbreviation: string
  testament: string
}

export interface AutocompleteResult {
  suggestion: string
  matchedBook?: Book
  chapter?: number
  verse?: number
  stage: "book" | "chapter" | "verse" | "complete" | "none"
}

/**
 * Convert number to Roman numeral for numbered books
 */
export function numberToRoman(num: number): string {
  if (num === 1) return "I"
  if (num === 2) return "II"
  if (num === 3) return "III"
  return String(num)
}

/**
 * Normalize input: convert leading numbers to Roman numerals for matching
 * Examples: "1 S" -> "I S", "2 C" -> "II C", "3 J" -> "III J"
 */
export function normalizeInput(input: string): string {
  const trimmed = input.trim()
  const leadingNumberMatch = trimmed.match(/^(\d+)\s*(.*)$/)

  if (leadingNumberMatch) {
    const num = parseInt(leadingNumberMatch[1])
    const rest = leadingNumberMatch[2]
    return numberToRoman(num) + (rest ? " " + rest : "")
  }

  return trimmed
}

function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/**
 * Canonicalize a book name or query prefix for cross-translation matching:
 * fold diacritics, collapse whitespace, lowercase, and unify leading Arabic
 * ("1", "2", "3") and Roman ("I ", "II", "III") book numbers.
 */
function normalizeBookText(value: string): string {
  const folded = foldDiacritics(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
  const arabicMatch = folded.match(/^([123])(?:\s+(.*)|([\p{L}].*))?$/u)
  if (arabicMatch) {
    const rest = arabicMatch[2] ?? arabicMatch[3]
    return rest ? `${arabicMatch[1]} ${rest}` : arabicMatch[1]
  }
  const romanMatch = folded.match(/^(iii|ii|i)(?:\s+(.*))?$/)
  if (romanMatch) {
    const numeral = romanMatch[1]
    const rest = romanMatch[2]
    // Leave bare "i" untouched so it can still match "Isaiah" as well as "I ..."
    if (numeral === "i" && rest === undefined) {
      return folded
    }
    const digit = numeral === "iii" ? "3" : numeral === "ii" ? "2" : "1"
    return rest ? `${digit} ${rest}` : digit
  }
  return folded
}

/**
 * Find matching book by name or abbreviation (case- and diacritic-insensitive,
 * supporting both Arabic and Roman leading book numbers).
 */
export function findMatchingBook(
  bookInput: string,
  books: Book[]
): Book | undefined {
  const normalized = normalizeBookText(bookInput)
  if (!normalized) return undefined
  return books.find((b) => {
    const name = normalizeBookText(b.name)
    const abbr = normalizeBookText(b.abbreviation)
    return (
      name.startsWith(normalized) ||
      abbr.startsWith(normalized) ||
      foldDiacritics(b.name).trim().toLowerCase().startsWith(normalized)
    )
  })
}

/**
 * Parse Bible reference input and return autocomplete suggestion
 */
export function getAutocompleteSuggestion(
  input: string,
  books: Book[]
): AutocompleteResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { suggestion: "", stage: "none" }
  }

  const normalizedInput = normalizeInput(trimmed)

  // Check if it's just a number (for numbered books like "1", "2", "3")
  if (/^\d+$/.test(trimmed)) {
    const numPrefix = normalizeBookText(trimmed) + " "
    const matchingBook = books.find((b) =>
      normalizeBookText(b.name).startsWith(numPrefix)
    )

    if (matchingBook) {
      return {
        suggestion: matchingBook.name + " 1:1",
        matchedBook: matchingBook,
        chapter: 1,
        verse: 1,
        stage: "book",
      }
    }
  }

  // Parse: "NumberedBook Chapter:Verse" or "BookName Chapter:Verse"
  // Match patterns like: "I J", "1 John", "Daniël 2:44", "John 3", "John 3:16"
  const match = normalizedInput.match(
    /^((?:(?:[IVX]+|[123])\s+)?[\p{L}\s]+?)\s*(?:(\d+)(?::(\d+)?)?)?$/iu
  )

  if (!match) {
    return { suggestion: "", stage: "none" }
  }

  const bookInput = match[1].trim()
  const chapterNum = match[2]
  const verseNum = match[3]

  const matchingBook = findMatchingBook(bookInput, books)

  if (!matchingBook) {
    return { suggestion: "", stage: "none" }
  }

  // Stage 1: Autocomplete book name + suggest 1:1
  if (!chapterNum) {
    return {
      suggestion: matchingBook.name + " 1:1",
      matchedBook: matchingBook,
      chapter: 1,
      verse: 1,
      stage: "book",
    }
  }

  const chapter = parseInt(chapterNum)

  // Stage 2: Suggest colon after chapter
  if (!verseNum && !trimmed.includes(":")) {
    return {
      suggestion: trimmed + ":1",
      matchedBook: matchingBook,
      chapter,
      verse: 1,
      stage: "chapter",
    }
  }

  // Stage 3: Has colon but no verse number yet
  if (!verseNum && trimmed.includes(":")) {
    return {
      suggestion: "",
      matchedBook: matchingBook,
      chapter,
      stage: "verse",
    }
  }

  // Stage 4: Complete reference
  if (verseNum) {
    const verse = parseInt(verseNum)
    return {
      suggestion: "",
      matchedBook: matchingBook,
      chapter,
      verse,
      stage: "complete",
    }
  }

  return { suggestion: "", stage: "none" }
}

export function getGhostSuggestionSuffix(
  input: string,
  suggestion: string
): string | null {
  if (!input || !suggestion) return null
  if (suggestion.length <= input.length) return null
  if (!suggestion.toLowerCase().startsWith(input.toLowerCase())) return null
  return suggestion.slice(input.length)
}

/**
 * Determine what should happen when Tab/Arrow-Right is pressed
 */
export function getTabNavigationResult(
  currentInput: string,
  currentSuggestion: string
): string {
  if (!currentSuggestion || currentSuggestion === currentInput) {
    return currentInput
  }

  const trimmed = currentInput.trim()
  const suggestionTrimmed = currentSuggestion.trim()

  // Extract the full book name from the suggestion
  const bookNameMatch = suggestionTrimmed.match(
    /^(((?:[IVX]+|[123])\s+)?[\p{L}\s]+)\s+\d+:\d+$/iu
  )

  if (bookNameMatch) {
    const fullBookName = bookNameMatch[1]

    // Check if current input matches the COMPLETE book name
    const currentIsCompleteBookName =
      trimmed === fullBookName + " " || trimmed === fullBookName

    // Check if current input has a chapter number
    const hasChapter =
      new RegExp(
        `^${fullBookName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+\\d+`,
        "i"
      ).test(trimmed) && !trimmed.includes(":")

    // Stage 1: Still typing book name -> advance to complete book name
    if (!currentIsCompleteBookName && !hasChapter) {
      return fullBookName + " "
    }

    // Stage 2: Has chapter -> advance to chapter with colon
    if (hasChapter) {
      const chapterMatch = suggestionTrimmed.match(
        /^(((?:[IVX]+|[123])\s+)?[\p{L}\s]+\s+\d+):\d+$/iu
      )
      if (chapterMatch) {
        return chapterMatch[1] + ":"
      }
    }
  }

  // Default: accept full suggestion
  return currentSuggestion
}
