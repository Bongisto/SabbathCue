import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { ResultCard } from "@/components/panels/search/ResultCard"
import { createScriptureQueueItem, presentVerse, selectPreviewVerse } from "@/lib/presentation-workflow"
import { flashQueuedVerse } from "@/lib/queue-flash"
import { useQueueStore } from "@/stores/queue-store"
import type { SemanticSearchResult, Verse } from "@/types"
import { SparklesIcon } from "lucide-react"
import { CONTEXT_SEARCH_MIN_QUERY_LENGTH } from "@/hooks/use-context-verse-search"

export function ContextSearchTab({
  contextQuery,
  semanticResults,
  activeTranslationId,
  translationLabel,
  queuedVerseKeys,
}: {
  contextQuery: string
  semanticResults: SemanticSearchResult[]
  activeTranslationId: number
  translationLabel: string
  queuedVerseKeys: Set<string>
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-0 p-2">
        {contextQuery.length < CONTEXT_SEARCH_MIN_QUERY_LENGTH ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <PanelEmptyState
              icon={<SparklesIcon className="size-8" />}
              title="Type to search"
              description="Search by meaning — type a phrase, paraphrase, or topic..."
            />
          </div>
        ) : null}
        {contextQuery.length >= CONTEXT_SEARCH_MIN_QUERY_LENGTH && semanticResults.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <PanelEmptyState
              icon={<SparklesIcon className="size-8" />}
              title="No results found"
              description="Try a different phrase, paraphrase, or topic."
            />
          </div>
        ) : null}
        {semanticResults.map((result, index) => {
          const verse: Verse = {
            id: 0,
            translation_id: activeTranslationId,
            book_number: result.book_number,
            book_name: result.book_name,
            book_abbreviation: "",
            chapter: result.chapter,
            verse: result.verse,
            text: result.verse_text,
          }
          const reference = `${result.book_name} ${result.chapter}:${result.verse}`
          return (
            <ResultCard
              key={`${result.book_number}-${result.chapter}-${result.verse}-${index}`}
              reference={reference}
              text={result.verse_text}
              badgeLabel={translationLabel}
              similarity={result.similarity}
              highlightQuery={contextQuery}
              queued={queuedVerseKeys.has(
                `${result.book_number}:${result.chapter}:${result.verse}`
              )}
              onPreview={() => selectPreviewVerse(verse)}
              onLive={() => presentVerse(verse)}
              onQueue={() =>
                useQueueStore.getState().addOrFlashItem(
                  createScriptureQueueItem(verse, {
                    reference,
                    confidence: result.similarity,
                    source: "manual",
                  })
                )
              }
              onQueuedClick={() =>
                flashQueuedVerse(result.book_number, result.chapter, result.verse)
              }
            />
          )
        })}
      </div>
    </div>
  )
}
