import { useEgwStore } from "@/stores/egw-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import type {
  EgwBook,
  EgwPageInfo,
  EgwParagraph,
  EgwSemanticResult,
  EgwSemanticStatus,
} from "@/types"

let pageRequestId = 0
let searchRequestId = 0
let pagesRequestId = 0

async function loadBooks() {
  if (!isTauriRuntime()) return []
  const books = await invokeTauri<EgwBook[]>("egw_list_books")
  useEgwStore.getState().setBooks(books)
  return books
}

async function loadPages(bookNumber: number) {
  if (!isTauriRuntime()) return []
  const reqId = ++pagesRequestId
  const pages = await invokeTauri<EgwPageInfo[]>("egw_list_pages", {
    bookNumber,
  })
  if (reqId !== pagesRequestId) return pages
  const store = useEgwStore.getState()
  store.setPages(pages)
  if (pages.length > 0 && !pages.some((p) => p.page === store.selectedPage)) {
    store.setSelectedPage(pages[0]!.page)
  }
  return pages
}

async function loadPage(bookNumber: number, page: number) {
  if (!isTauriRuntime()) return []
  const reqId = ++pageRequestId
  const paragraphs = await invokeTauri<EgwParagraph[]>("egw_get_page", {
    bookNumber,
    page,
  })
  if (reqId !== pageRequestId) return paragraphs
  useEgwStore.getState().setCurrentParagraphs(paragraphs)
  return paragraphs
}

async function search(query: string, limit = 20) {
  if (!isTauriRuntime()) return []
  const reqId = ++searchRequestId
  const results = await invokeTauri<EgwParagraph[]>("egw_search", {
    query,
    limit,
  })
  if (reqId !== searchRequestId) return results
  useEgwStore.getState().setSearchResults(results)
  return results
}

async function contextSearch(query: string, limit = 20) {
  if (!isTauriRuntime()) return []
  const reqId = ++searchRequestId
  const results = await invokeTauri<EgwSemanticResult[]>("egw_semantic_search", {
    query,
    limit,
  })
  const paragraphs = results.map((r) => r.paragraph)
  if (reqId !== searchRequestId) return paragraphs
  useEgwStore.getState().setSearchResults(paragraphs)
  return paragraphs
}

async function loadSemanticStatus() {
  if (!isTauriRuntime()) return null
  const status = await invokeTauri<EgwSemanticStatus>("egw_semantic_status")
  useEgwStore.getState().setSemanticStatus(status)
  return status
}

async function buildSemanticIndex() {
  if (!isTauriRuntime()) return
  await invokeTauri("egw_build_semantic_index")
  await loadSemanticStatus()
}

export const egwActions = {
  loadBooks,
  loadPages,
  loadPage,
  search,
  contextSearch,
  loadSemanticStatus,
  buildSemanticIndex,
}

export function useEgw() {
  const books = useEgwStore((s) => s.books)
  const selectedBookNumber = useEgwStore((s) => s.selectedBookNumber)
  const pages = useEgwStore((s) => s.pages)
  const selectedPage = useEgwStore((s) => s.selectedPage)
  const currentParagraphs = useEgwStore((s) => s.currentParagraphs)
  const searchResults = useEgwStore((s) => s.searchResults)
  const selectedParagraphId = useEgwStore((s) => s.selectedParagraphId)
  const searchMode = useEgwStore((s) => s.searchMode)
  const semanticStatus = useEgwStore((s) => s.semanticStatus)
  const indexProgress = useEgwStore((s) => s.indexProgress)

  return {
    books,
    selectedBookNumber,
    pages,
    selectedPage,
    currentParagraphs,
    searchResults,
    selectedParagraphId,
    searchMode,
    semanticStatus,
    indexProgress,
    ...egwActions,
  }
}
