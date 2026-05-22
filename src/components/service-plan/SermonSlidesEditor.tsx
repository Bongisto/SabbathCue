import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { invokeTauri } from "@/lib/tauri-runtime"
import type { ServiceAttachment } from "@/types/service-plan"
import { ChevronDownIcon, ChevronUpIcon, UploadIcon, XIcon } from "lucide-react"

const SERMON_SLIDE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"]

interface ServiceAttachmentValidation {
  label: string
  kind: ServiceAttachment["kind"]
  sizeBytes: number
}

interface SermonSlidesEditorProps {
  attachments: ServiceAttachment[]
  onChange: (attachments: ServiceAttachment[]) => void
}

function nextOrder(attachments: ServiceAttachment[]): number {
  return attachments.reduce((max, attachment) => Math.max(max, attachment.order ?? -1), -1) + 1
}

async function createSlideAttachment(path: string, order: number): Promise<ServiceAttachment | null> {
  try {
    const validated = await invokeTauri<ServiceAttachmentValidation>(
      "validate_service_attachment_path",
      { path },
    )
    if (validated.kind !== "slide") return null
    const thumbnailUrl = await invokeTauri<string>("read_image_as_data_url", { path })
    return {
      id: crypto.randomUUID(),
      kind: "slide",
      label: validated.label,
      path,
      status: "ready",
      sizeBytes: validated.sizeBytes,
      thumbnailUrl,
      order,
    }
  } catch {
    return null
  }
}

function orderedSlides(attachments: ServiceAttachment[]): ServiceAttachment[] {
  return [...attachments].sort(
    (a, b) => (a.order ?? attachments.indexOf(a)) - (b.order ?? attachments.indexOf(b)),
  )
}

export function SermonSlidesEditor({ attachments, onChange }: SermonSlidesEditorProps) {
  const slides = orderedSlides(attachments)

  const uploadSlides = async () => {
    let selected: string | string[] | null
    try {
      selected = await open({
        multiple: true,
        filters: [{ name: "Sermon slide images", extensions: SERMON_SLIDE_EXTENSIONS }],
      })
    } catch {
      return
    }

    const paths = Array.isArray(selected) ? selected : selected ? [selected] : []
    if (paths.length === 0) return

    let order = nextOrder(attachments)
    const uploaded = (
      await Promise.all(
        paths.map((path) => {
          const currentOrder = order
          order += 1
          return createSlideAttachment(path, currentOrder)
        }),
      )
    ).filter((attachment): attachment is ServiceAttachment => attachment !== null)

    if (uploaded.length > 0) onChange([...attachments, ...uploaded])
  }

  const updateSlide = (id: string, patch: Partial<ServiceAttachment>) => {
    onChange(attachments.map((attachment) => (attachment.id === id ? { ...attachment, ...patch } : attachment)))
  }

  const removeSlide = (id: string) => {
    onChange(
      orderedSlides(attachments.filter((attachment) => attachment.id !== id)).map((slide, index) => ({
        ...slide,
        order: index,
      })),
    )
  }

  const moveSlide = (id: string, delta: number) => {
    const next = orderedSlides(attachments)
    const index = next.findIndex((slide) => slide.id === id)
    const targetIndex = index + delta
    if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    onChange(next.map((slide, order) => ({ ...slide, order })))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Sermon slides
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{slides.length} slides</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void uploadSlides()}>
            <UploadIcon className="size-3" />
            Upload slides
          </Button>
        </div>
      </div>

      {slides.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          Upload image slides for this service item. Voice commands control only these slides while this item is active.
        </p>
      ) : (
        <div className="space-y-1.5">
          {slides.map((slide, index) => (
            <div key={slide.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border p-2">
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded bg-muted">
                {slide.thumbnailUrl ? (
                  <img src={slide.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[0.625rem] text-muted-foreground">{index + 1}</span>
                )}
              </div>
              <Input
                value={slide.label}
                onChange={(event) => updateSlide(slide.id, { label: event.target.value })}
                className="h-8 text-xs"
                aria-label={`Slide ${index + 1} label`}
              />
              <div className="flex items-center gap-1">
                <Button size="icon-xs" variant="ghost" disabled={index === 0} onClick={() => moveSlide(slide.id, -1)}>
                  <ChevronUpIcon className="size-3" />
                </Button>
                <Button size="icon-xs" variant="ghost" disabled={index === slides.length - 1} onClick={() => moveSlide(slide.id, 1)}>
                  <ChevronDownIcon className="size-3" />
                </Button>
                <Button size="icon-xs" variant="ghost" onClick={() => removeSlide(slide.id)}>
                  <XIcon className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
