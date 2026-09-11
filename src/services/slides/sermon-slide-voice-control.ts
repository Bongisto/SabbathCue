import { presentSermonSlideAt } from "@/services/slides/sermon-slide-live"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import {
  extractSpokenNumberPhrase,
  isSpokenNumberToken,
  parsePositiveSpokenNumber,
} from "@/lib/spoken-number"

export type SermonSlideCommand =
  | { kind: "next" }
  | { kind: "previous" }
  | { kind: "jump"; slideNumber: number }

const SLIDE_JUMP_PATTERN =
  /\b(?:go\s+to\s+)?slide\s+(?:number\s+)?([a-z0-9][a-z0-9\s-]*)/i
const NEXT_SLIDE_PATTERN = /\b(?:next|advance)\s+slide\b/i
const PREVIOUS_SLIDE_PATTERN = /\b(?:previous|prev|back|go\s+back)\s+slide\b/i

/**
 * Accept digits and spoken numbers that start the tail immediately after
 * "slide (number)?", ignoring trailing speech exactly like the digit path
 * always did ("slide 3 please", "slide 2-3" → slide 2). Requiring the first
 * token to be a number keeps prose such as "the next slide shows three
 * examples" falling through to the next/previous commands instead of jumping.
 */
function parseSlideJumpNumber(tail: string): number | null {
  const firstToken = tail.trim().split(/\s+/)[0] ?? ""
  // Digit-leading tokens keep the original `\d{1,3}\b` semantics exactly,
  // including "2-3" ranges and rejecting 4-digit numbers.
  const digitMatch = firstToken.match(/^\d{1,3}\b/)
  if (digitMatch) {
    const slideNumber = Number.parseInt(digitMatch[0], 10)
    return slideNumber > 0 ? slideNumber : null
  }
  if (!isSpokenNumberToken(firstToken)) return null
  const number = parsePositiveSpokenNumber(extractSpokenNumberPhrase(tail))
  return number !== null && number <= 999 ? number : null
}

export function parseSermonSlideCommand(text: string): SermonSlideCommand | null {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return null

  const jump = normalized.match(SLIDE_JUMP_PATTERN)
  if (jump) {
    const slideNumber = parseSlideJumpNumber(jump[1])
    if (slideNumber !== null) {
      return { kind: "jump", slideNumber }
    }
  }

  if (NEXT_SLIDE_PATTERN.test(normalized)) return { kind: "next" }
  if (PREVIOUS_SLIDE_PATTERN.test(normalized)) return { kind: "previous" }

  return null
}

function activeServiceItem() {
  const plan = useServicePlanStore.getState().activePlan
  if (!plan?.activeItemId) return null
  return plan.items.find((item) => item.id === plan.activeItemId) ?? null
}

export function handleSermonSlideVoiceControl(text: string): boolean {
  const command = parseSermonSlideCommand(text)
  if (!command) return false

  const item = activeServiceItem()
  if (!item) return false

  const deck = buildSermonSlideDeck(item)
  if (deck.length === 0) return false

  const current = useSermonSlideStore.getState()
  const currentIndex =
    current.activeItemId === item.id
      ? Math.max(0, Math.min(deck.length - 1, current.activeIndex))
      : 0

  const targetIndex =
    command.kind === "jump"
      ? command.slideNumber - 1
      : command.kind === "next"
        ? currentIndex + 1
        : currentIndex - 1

  return presentSermonSlideAt(targetIndex)
}
