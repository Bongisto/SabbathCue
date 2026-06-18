import type { ComponentType } from "react"
import { FolderIcon, ImageIcon, LayoutTemplateIcon, MusicIcon, PaletteIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useLibraryStore } from "@/stores/library-store"
import type { LibraryAssetType } from "@/types/library"

export type LibraryFilter = "all" | LibraryAssetType | `collection:${string}`

interface CollectionSidebarProps {
  filter: LibraryFilter
  onFilterChange: (filter: LibraryFilter) => void
}

const TYPE_FILTERS: Array<{
  id: LibraryFilter
  label: string
  icon: ComponentType<{ className?: string }>
}> = [
  { id: "all", label: "All Assets", icon: FolderIcon },
  { id: "theme", label: "Themes", icon: PaletteIcon },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "song", label: "Songs", icon: MusicIcon },
  { id: "slide-template", label: "Slide Templates", icon: LayoutTemplateIcon },
]

export function CollectionSidebar({
  filter,
  onFilterChange,
}: CollectionSidebarProps) {
  const collections = useLibraryStore((state) => state.collections)
  const createCollection = useLibraryStore((state) => state.createCollection)
  const renameCollection = useLibraryStore((state) => state.renameCollection)
  const deleteCollection = useLibraryStore((state) => state.deleteCollection)

  return (
    <aside className="flex min-h-0 w-72 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)]">
      <div className="border-b border-[var(--border-subtle)] p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => createCollection("New Collection")}
        >
          <PlusIcon className="size-3.5" />
          New Collection
        </Button>
      </div>

      <div className="space-y-1 border-b border-[var(--border-subtle)] p-2">
        {TYPE_FILTERS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium",
                filter === item.id
                  ? "bg-[var(--accent-glow)] text-[var(--accent)]"
                  : "text-muted-foreground hover:bg-[var(--shell-bg-sunken)] hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Collections
        </p>
        <div className="space-y-1">
          {collections.map((collection) => {
            const selected = filter === `collection:${collection.id}`
            return (
              <div
                key={collection.id}
                className={cn(
                  "group grid grid-cols-[1fr_auto] items-center gap-1 rounded-md px-1 py-1",
                  selected && "bg-[var(--accent-glow)]",
                )}
              >
                <Input
                  value={collection.name}
                  aria-label={`Rename ${collection.name}`}
                  onFocus={() => onFilterChange(`collection:${collection.id}`)}
                  onChange={(event) =>
                    renameCollection(collection.id, event.target.value)
                  }
                  className="h-7 border-0 bg-transparent px-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${collection.name}`}
                  onClick={() => deleteCollection(collection.id)}
                >
                  <Trash2Icon className="size-3" />
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
