import { open } from "@tauri-apps/plugin-dialog"
import { stat } from "@tauri-apps/plugin-fs"
import { Button } from "@/components/ui/button"
import type { ServiceAttachment } from "@/types/service-plan"

const MAX_SLIDE_SIZE_BYTES = 100 * 1024 * 1024
const MAX_MEDIA_SIZE_BYTES = 750 * 1024 * 1024

const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "mp4",
  "mov",
  "webm",
  "pdf",
]

interface MediaAttachmentsEditorProps {
  attachments: ServiceAttachment[]
  onChange: (attachments: ServiceAttachment[]) => void
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop()?.trim() || "Attachment"
}

function extensionFromPath(path: string): string {
  return fileNameFromPath(path).split(".").pop()?.toLowerCase() ?? ""
}

function attachmentKindFromPath(path: string): ServiceAttachment["kind"] {
  const extension = extensionFromPath(path)
  if (["png", "jpg", "jpeg", "webp", "gif", "pdf"].includes(extension)) return "slide"
  if (["mp4", "mov", "webm"].includes(extension)) return "media"
  return "document"
}

function isSupportedAttachmentPath(path: string): boolean {
  return SUPPORTED_ATTACHMENT_EXTENSIONS.includes(extensionFromPath(path))
}

function hasUrlScheme(path: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)
}

function isNetworkPath(path: string): boolean {
  return path.startsWith("\\\\") || path.startsWith("//")
}

function isBlockedSystemPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").toLowerCase()
  return (
    /^[a-z]:\/windows(\/|$)/i.test(normalized) ||
    /^[a-z]:\/program files( \(x86\))?(\/|$)/i.test(normalized) ||
    /^[a-z]:\/programdata(\/|$)/i.test(normalized) ||
    normalized.startsWith("/etc/") ||
    normalized.startsWith("/bin/") ||
    normalized.startsWith("/sbin/") ||
    normalized.startsWith("/usr/") ||
    normalized.startsWith("/var/") ||
    normalized.startsWith("/system/") ||
    normalized.startsWith("/library/")
  )
}

function isAllowedLocalAttachmentPath(path: string): boolean {
  if (!path.trim()) return false
  if (hasUrlScheme(path)) return false
  if (isNetworkPath(path)) return false
  if (path.includes("..")) return false
  if (isBlockedSystemPath(path)) return false
  return isSupportedAttachmentPath(path)
}

function maxSizeForKind(kind: ServiceAttachment["kind"]): number {
  return kind === "media" ? MAX_MEDIA_SIZE_BYTES : MAX_SLIDE_SIZE_BYTES
}

async function createAttachmentFromPath(path: string): Promise<ServiceAttachment | null> {
  if (!isAllowedLocalAttachmentPath(path)) return null

  const kind = attachmentKindFromPath(path)
  try {
    const info = await stat(path)
    if (!info.isFile) return null
    if (info.size > maxSizeForKind(kind)) return null
    return {
      id: crypto.randomUUID(),
      kind,
      label: fileNameFromPath(path),
      path,
      status: "pending",
      sizeBytes: info.size,
    }
  } catch {
    return null
  }
}

export function MediaAttachmentsEditor({ attachments, onChange }: MediaAttachmentsEditorProps) {
  const attachFiles = async () => {
    let selected: string | string[] | null
    try {
      selected = await open({
        multiple: true,
        filters: [
          {
            name: "Slides and media",
            extensions: SUPPORTED_ATTACHMENT_EXTENSIONS,
          },
        ],
      })
    } catch {
      return
    }

    const paths = (Array.isArray(selected) ? selected : selected ? [selected] : []).filter(
      isAllowedLocalAttachmentPath,
    )
    if (paths.length === 0) return

    const selectedAttachments = (
      await Promise.all(paths.map((path) => createAttachmentFromPath(path)))
    ).filter((attachment): attachment is ServiceAttachment => attachment !== null)

    if (selectedAttachments.length === 0) return
    onChange([...attachments, ...selectedAttachments])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Slides and media
        </span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void attachFiles()}>
          Attach files
        </Button>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No slide or media files attached.</p>
      ) : (
        <div className="space-y-1 text-xs">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1">
              <span className="truncate">
                {attachment.label} <span className="text-muted-foreground">({attachment.kind})</span>
                {typeof attachment.sizeBytes === "number" && (
                  <span className="text-muted-foreground">
                    {" "}
                    - {(attachment.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => onChange(attachments.filter((entry) => entry.id !== attachment.id))}
              >
                x
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
