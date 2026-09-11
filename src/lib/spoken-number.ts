const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  nul: 0,
  een: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vyf: 5,
  ses: 6,
  sewe: 7,
  agt: 8,
  nege: 9,
  tien: 10,
  elf: 11,
  twaalf: 12,
  dertien: 13,
  veertien: 14,
  vyftien: 15,
  sestien: 16,
  sewentien: 17,
  agtien: 18,
  negentien: 19,
}

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  twintig: 20,
  dertig: 30,
  veertig: 40,
  vyftig: 50,
  sestig: 60,
  sewentig: 70,
  tagtig: 80,
  negentig: 90,
}

const HUNDRED_WORDS = new Set(["hundred", "honderd"])

/** Afrikaans inverted number compounds spoken as one word — "eenentwintig"
 *  (21), "tweeëntwintig" (22), "drieënveertig" (43) — built as
 *  [ones] + en/ën + [tens]. Only exact ones/tens bookends match, so ordinary
 *  words never decompose into numbers. */
const AFRIKAANS_COMPOUND_ONES: Record<string, number> = {
  een: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vyf: 5,
  ses: 6,
  sewe: 7,
  agt: 8,
  nege: 9,
}
const AFRIKAANS_COMPOUND_TENS: Record<string, number> = {
  twintig: 20,
  dertig: 30,
  veertig: 40,
  vyftig: 50,
  sestig: 60,
  sewentig: 70,
  tagtig: 80,
  negentig: 90,
}

function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function parseAfrikaansCompoundNumber(token: string): number | null {
  const folded = foldDiacritics(token.toLowerCase())
  for (const [ones, onesValue] of Object.entries(AFRIKAANS_COMPOUND_ONES)) {
    if (!folded.startsWith(ones)) continue
    const rest = folded.slice(ones.length)
    if (!rest.startsWith("en")) continue
    const tensValue = AFRIKAANS_COMPOUND_TENS[rest.slice(2)]
    if (tensValue !== undefined) return tensValue + onesValue
  }
  return null
}

/** True for any token `parsePositiveSpokenNumber` accepts inside a number
 *  phrase: digits, English/Afrikaans number words, "hundred", and Afrikaans
 *  inverted compounds ("drieentwintig"). */
export function isSpokenNumberToken(token: string): boolean {
  const folded = foldDiacritics(token.toLowerCase())
  return (
    /^\d+$/.test(folded) ||
    Object.hasOwn(ONES, folded) ||
    Object.hasOwn(TENS, folded) ||
    HUNDRED_WORDS.has(folded) ||
    parseAfrikaansCompoundNumber(folded) !== null
  )
}

/** Connector words ("and"/"en") that may sit inside a number phrase but are
 *  meaningless at its edges ("hymn 46 and then…"). */
export function isSpokenNumberConnector(token: string): boolean {
  return token === "and" || token === "en"
}

/**
 * Trim a captured tail down to the leading number phrase at its start. A
 * capture after a cue word runs to the end of the utterance, so trailing
 * service speech ("hymn 46 then we pray") must not be fed to the number
 * parser; conversely, filler between the cue and the number ("our next hymn
 * is number 302") must be skipped. Connector words are phrase-internal only
 * ("ses en veertig"); at the edges they belong to the surrounding speech.
 */
export function extractSpokenNumberPhrase(phrase: string): string {
  const out: string[] = []
  for (const token of phrase.split(/\s+/).filter(Boolean)) {
    if (isSpokenNumberToken(token) || isSpokenNumberConnector(token)) {
      out.push(token)
    } else if (out.length > 0) {
      break
    }
  }
  while (out.length > 0 && isSpokenNumberConnector(out[out.length - 1])) {
    out.pop()
  }
  let start = 0
  while (start < out.length && isSpokenNumberConnector(out[start])) start++
  return out.slice(start).join(" ")
}

function parseUnderHundred(words: string[]): number | null {
  if (words.length === 1) {
    const single = words[0]
    const exact = Object.hasOwn(ONES, single)
      ? ONES[single]
      : Object.hasOwn(TENS, single)
        ? TENS[single]
        : parseAfrikaansCompoundNumber(single)
    return exact ?? null
  }

  if (words.length === 2 && Object.hasOwn(TENS, words[0]) && Object.hasOwn(ONES, words[1])) {
    return TENS[words[0]] + ONES[words[1]]
  }

  if (
    words.length === 3 &&
    Object.hasOwn(ONES, words[0]) &&
    (words[1] === "and" || words[1] === "en") &&
    Object.hasOwn(TENS, words[2])
  ) {
    return TENS[words[2]] + ONES[words[0]]
  }

  return null
}

export function parsePositiveSpokenNumber(value: string): number | null {
  const normalized = foldDiacritics(value.trim().toLowerCase())
  if (!normalized) return null

  if (/^\d+$/.test(normalized)) {
    const number = Number.parseInt(normalized, 10)
    return Number.isSafeInteger(number) && number > 0 ? number : null
  }

  const words = normalized.replace(/-/g, " ").split(/\s+/).filter(Boolean)
  const hundredIndex = words.findIndex(
    (word) => word === "hundred" || word === "honderd"
  )

  if (hundredIndex === -1) {
    const number = parseUnderHundred(words)
    return number !== null && number > 0 ? number : null
  }

  if (hundredIndex > 1) return null
  const multiplier = hundredIndex === 0 ? 1 : (ONES[words[0]] ?? Number.NaN)
  if (!Number.isInteger(multiplier) || multiplier <= 0 || multiplier > 9) {
    return null
  }

  const remainderWords = words
    .slice(hundredIndex + 1)
    .filter((word, index) => index !== 0 || (word !== "and" && word !== "en"))
  if (remainderWords.some((word) => word === "hundred" || word === "honderd")) {
    return null
  }

  const remainder =
    remainderWords.length === 0 ? 0 : parseUnderHundred(remainderWords)
  if (remainder === null) return null

  return multiplier * 100 + remainder
}
