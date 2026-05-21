import { SDA_HYMNAL } from "@/data/sda-hymnal"
import type { Hymn, HymnSearchResult } from "@/types"

function toSearchResult(hymn: Hymn): HymnSearchResult {
  return {
    id: hymn.id,
    number: hymn.number,
    title: hymn.title,
    firstLine: hymn.firstLine,
    category: hymn.category,
  }
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

export function searchHymns(query: string, limit = 20): HymnSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return SDA_HYMNAL.slice(0, limit).map(toSearchResult)

  const q = normalized(trimmed)
  const number = Number(trimmed)
  const ranked = SDA_HYMNAL
    .map((hymn) => {
      const title = normalized(hymn.title)
      const firstLine = normalized(hymn.firstLine ?? "")
      let score = 0

      if (Number.isInteger(number) && hymn.number === number) score += 100
      if (String(hymn.number).startsWith(trimmed)) score += 40
      if (title === q) score += 80
      if (title.startsWith(q)) score += 50
      if (title.includes(q)) score += 30
      if (firstLine.includes(q)) score += 20

      return { hymn, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.hymn.number - b.hymn.number)

  return ranked.slice(0, limit).map((entry) => toSearchResult(entry.hymn))
}

export function getHymnById(id: string): Hymn | null {
  return SDA_HYMNAL.find((hymn) => hymn.id === id) ?? null
}

export function getHymnByNumber(number: number): Hymn | null {
  return SDA_HYMNAL.find((hymn) => hymn.number === number) ?? null
}

export function getInitialHymns(limit = 12): HymnSearchResult[] {
  return SDA_HYMNAL.slice(0, limit).map(toSearchResult)
}
