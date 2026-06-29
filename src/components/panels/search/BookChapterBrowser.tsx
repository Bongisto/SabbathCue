import { Button } from "@/components/ui/button"
import { ResultCard } from "@/components/panels/search/ResultCard"
import {
  createScriptureQueueItem,
  presentVerse,
} from "@/lib/presentation-workflow"
import { flashQueuedVerse } from "@/lib/queue-flash"
import { useQueueStore } from "@/stores/queue-store"
import type { Book, Verse } from "@/types"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"

export function BookChapterBrowser({
  selectedBook,
  chapter,
  maxChapter,
  currentChapter,
  effectiveSelectedVerseId,
  queuedVerseKeys,
  translationLabel,
  onChapterChange,
  onSelectVerse,
}: {
  selectedBook: Book | null
  chapter: number
  maxChapter: number
  currentChapter: Verse[]
  effectiveSelectedVerseId: number | null
  queuedVerseKeys: Set<string>
  translationLabel: string
  onChapterChange: (chapter: number) => void
  onSelectVerse: (verse: Verse) => void
}) {
  return (
    <>
      <div className="flex min-h-9 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
        {selectedBook ? (
          <h3 className="text-sm font-semibold text-foreground">
            {selectedBook.name} {chapter}
          </h3>
        ) : null}
        {selectedBook ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onChapterChange(chapter > 1 ? chapter - 1 : chapter)}
              disabled={chapter <= 1}
            >
              <ArrowLeftIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onChapterChange(chapter < maxChapter ? chapter + 1 : chapter)}
              disabled={chapter >= maxChapter}
            >
              <ArrowRightIcon className="size-3" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5 p-2">
          {currentChapter.map((verse) => {
            const reference = `${verse.book_name} ${verse.chapter}:${verse.verse}`
            return (
              <ResultCard
                key={verse.id}
                domId={`verse-${verse.id}`}
                reference={reference}
                text={verse.text}
                badgeLabel={translationLabel}
                selected={verse.id === effectiveSelectedVerseId}
                queued={queuedVerseKeys.has(
                  `${verse.book_number}:${verse.chapter}:${verse.verse}`
                )}
                onPreview={() => onSelectVerse(verse)}
                onLive={() => presentVerse(verse)}
                onQueue={() =>
                  useQueueStore.getState().addOrFlashItem(
                    createScriptureQueueItem(verse, {
                      reference,
                      confidence: 1,
                      source: "manual",
                    })
                  )
                }
                onQueuedClick={() =>
                  flashQueuedVerse(verse.book_number, verse.chapter, verse.verse)
                }
              />
            )
          })}
        </div>
      </div>
    </>
  )
}
