import { useCallback, useEffect, useState } from "react"
import { MegaphoneIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminListAnnouncements,
  adminUpdateAnnouncement,
  type AdminAnnouncementRow,
} from "@/lib/supabase/announcements"

function formatTimestamp(value: string | null): string {
  if (!value) return "-"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "unknown" : parsed.toLocaleString()
}

function statusLabel(status: AdminAnnouncementRow["status"]): string {
  switch (status) {
    case "draft":
      return "Draft"
    case "published":
      return "Published"
    case "expired":
      return "Expired"
  }
}

export function AnnouncementsAdminPanel() {
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [creating, setCreating] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    void adminListAnnouncements().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setAnnouncements(result.announcements)
        setLoadError(null)
      } else {
        setLoadError(result.message)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [reloadCount])

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setReloadCount((count) => count + 1)
  }, [])

  async function handleCreate() {
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle || !trimmedBody) {
      toast.error("Title and body are required.")
      return
    }

    setCreating(true)
    const result = await adminCreateAnnouncement(trimmedTitle, trimmedBody)
    setCreating(false)

    if (result.ok) {
      toast.success("Draft announcement created.")
      setTitle("")
      setBody("")
      await refresh()
    } else {
      toast.error(result.message)
    }
  }

  async function handlePublish(announcement: AdminAnnouncementRow) {
    setBusyId(announcement.id)
    const result = await adminUpdateAnnouncement({
      id: announcement.id,
      status: "published",
    })
    setBusyId(null)

    if (result.ok) {
      toast.success("Announcement published.")
      await refresh()
    } else {
      toast.error(result.message)
    }
  }

  async function handleExpire(announcement: AdminAnnouncementRow) {
    setBusyId(announcement.id)
    const result = await adminUpdateAnnouncement({
      id: announcement.id,
      status: "expired",
    })
    setBusyId(null)

    if (result.ok) {
      toast.success("Announcement expired.")
      await refresh()
    } else {
      toast.error(result.message)
    }
  }

  async function handleDelete(announcement: AdminAnnouncementRow) {
    setBusyId(announcement.id)
    const result = await adminDeleteAnnouncement(announcement.id)
    setBusyId(null)

    if (result.ok) {
      toast.success("Announcement deleted.")
      await refresh()
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MegaphoneIcon className="size-4 text-primary" />
          <p className="text-sm font-medium">Admin - Announcements</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="glass-panel space-y-3 p-3">
        <p className="text-xs text-muted-foreground">
          Drafts are visible here only. Published announcements appear once for
          signed-in users until dismissed.
        </p>
        <input
          className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="min-h-20 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
          placeholder="Message body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button
          size="sm"
          disabled={creating}
          onClick={() => void handleCreate()}
        >
          {creating ? "Creating..." : "Create draft"}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">
          Loading announcements...
        </p>
      ) : loadError ? (
        <p className="text-xs text-destructive">{loadError}</p>
      ) : announcements.length === 0 ? (
        <p className="text-xs text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map((announcement) => {
            const isBusy = busyId === announcement.id
            return (
              <div key={announcement.id} className="glass-panel space-y-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {announcement.title}
                    </p>
                    <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
                      {announcement.body}
                    </p>
                    <p className="mt-2 text-[10px] tracking-wide text-muted-foreground uppercase">
                      {statusLabel(announcement.status)}
                      {announcement.published_at
                        ? ` - published ${formatTimestamp(announcement.published_at)}`
                        : ""}
                      {announcement.expires_at
                        ? ` - expires ${formatTimestamp(announcement.expires_at)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {announcement.status === "draft" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handlePublish(announcement)}
                      >
                        Publish
                      </Button>
                    ) : announcement.status === "published" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleExpire(announcement)}
                      >
                        Expire
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      title={`Delete ${announcement.title}`}
                      aria-label={`Delete ${announcement.title}`}
                      onClick={() => void handleDelete(announcement)}
                    >
                      <Trash2Icon className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
