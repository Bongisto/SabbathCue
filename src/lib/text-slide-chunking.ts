export interface TextSlideChunkOptions {
  maxChars?: number
  softChars?: number
}

const DEFAULT_MAX_CHARS = 165
const DEFAULT_SOFT_CHARS = 135

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function splitLongToken(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  for (let index = 0; index < text.length; index += maxChars) {
    chunks.push(text.slice(index, index + maxChars))
  }
  return chunks
}

function splitByWords(text: string, maxChars: number): string[] {
  const words = normalizeText(text).split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let current = ""

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        chunks.push(current)
        current = ""
      }
      chunks.push(...splitLongToken(word, maxChars))
      continue
    }

    const next = current ? `${current} ${word}` : word
    if (current && next.length > maxChars) {
      chunks.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks
}

function splitSentence(sentence: string, maxChars: number, softChars: number): string[] {
  const trimmed = normalizeText(sentence)
  if (trimmed.length <= maxChars) return [trimmed]

  const clauses = trimmed
    .split(/(?<=[,;:])\s+/)
    .map((clause) => clause.trim())
    .filter(Boolean)

  if (clauses.length <= 1) return splitByWords(trimmed, maxChars)

  const chunks: string[] = []
  let current = ""

  for (const clause of clauses) {
    const next = current ? `${current} ${clause}` : clause
    if (current && next.length > softChars) {
      chunks.push(current)
      current = clause
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks.flatMap((chunk) =>
    chunk.length > maxChars ? splitByWords(chunk, maxChars) : [chunk],
  )
}

export function splitTextForReadableSlides(
  text: string,
  options: TextSlideChunkOptions = {},
): string[] {
  const normalized = normalizeText(text)
  if (!normalized) return [""]

  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const softChars = Math.min(options.softChars ?? DEFAULT_SOFT_CHARS, maxChars)
  const sentences = normalized.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [
    normalized,
  ]
  const chunks: string[] = []
  let current = ""

  for (const sentence of sentences.flatMap((entry) =>
    splitSentence(entry, maxChars, softChars),
  )) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    const next = current ? `${current} ${trimmed}` : trimmed
    if (current && next.length > softChars) {
      chunks.push(current)
      current = trimmed
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [normalized]
}

export function splitLyricLineForReadableSlides(
  line: string,
  maxChars = 42,
): string[] {
  const normalized = line.trim()
  if (!normalized) return []
  return splitByWords(normalized, maxChars)
}
