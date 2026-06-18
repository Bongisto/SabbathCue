import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseSongText, songDocToDeck } from "@/lib/library/song-doc"
import { useLibraryStore } from "@/stores/library-store"

interface SongEditorProps {
  onClose: () => void
}

const SAMPLE_SONG = `Amazing grace, how sweet the sound
That saved a soul like me

---

I once was lost, but now am found
Was blind, but now I see`

export function SongEditor({ onClose }: SongEditorProps) {
  const addAsset = useLibraryStore((state) => state.addAsset)
  const [title, setTitle] = useState("Custom Song")
  const [text, setText] = useState(SAMPLE_SONG)
  const song = useMemo(() => parseSongText(title, text), [text, title])
  const deck = useMemo(() => songDocToDeck(song), [song])
  const activeSlide = deck[0]

  const save = () => {
    addAsset({
      id: crypto.randomUUID(),
      name: song.title,
      type: "song",
      collectionIds: [],
      song,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    onClose()
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,0.8fr)_minmax(320px,1fr)] border-t border-[var(--border-subtle)]">
      <div className="flex min-h-0 flex-col gap-3 border-r border-[var(--border-subtle)] p-3">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">
          Song title
        </label>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        <label className="text-[10px] font-bold uppercase text-muted-foreground">
          Song text
        </label>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="search-input min-h-0 flex-1 resize-none p-3 text-sm leading-relaxed"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={deck.length === 0} onClick={save}>
            Save song
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-col p-3">
        <div className="mb-3">
          <p className="text-sm font-semibold text-foreground">{song.title}</p>
          <p className="text-xs text-muted-foreground">{deck.length} slides</p>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-deep)] p-8 text-center">
          {activeSlide ? (
            <div className="max-w-[80%] space-y-3 text-balance text-2xl font-semibold leading-snug text-neutral-50">
              {activeSlide.segments.map((segment) => (
                <p key={segment.text}>{segment.text}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No slides</p>
          )}
        </div>
      </div>
    </div>
  )
}
