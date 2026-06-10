import { create } from "zustand"
import type { EgwPresentationItemData } from "@/types"

interface EgwSlideState {
  deck: EgwPresentationItemData[]
  activeIndex: number
  setDeck: (deck: EgwPresentationItemData[], activeIndex: number) => void
}

export const useEgwSlideStore = create<EgwSlideState>((set) => ({
  deck: [],
  activeIndex: 0,
  setDeck: (deck, activeIndex) => {
    const safeIndex = Number.isFinite(activeIndex) ? activeIndex : 0
    set({
      deck,
      activeIndex:
        deck.length === 0
          ? 0
          : Math.max(0, Math.min(deck.length - 1, safeIndex)),
    })
  },
}))
