import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useAnnouncementsStore } from "@/stores/announcements-store"
import { useVerificationStore } from "@/stores/verification-store"

export function useAnnouncements() {
  const status = useVerificationStore((s) => s.status)
  const isHydrated = useAnnouncementsStore((s) => s.isHydrated)
  const announcements = useAnnouncementsStore((s) => s.announcements)
  const seenIds = useAnnouncementsStore((s) => s.seenIds)
  const hydrateSeenIds = useAnnouncementsStore((s) => s.hydrateSeenIds)
  const fetchAnnouncements = useAnnouncementsStore((s) => s.fetchAnnouncements)
  const markSeen = useAnnouncementsStore((s) => s.markSeen)
  const surfacedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    void hydrateSeenIds()
  }, [hydrateSeenIds])

  useEffect(() => {
    if (status !== "verified" || !isHydrated) return
    void fetchAnnouncements()
  }, [status, isHydrated, fetchAnnouncements])

  useEffect(() => {
    if (status !== "verified" || !isHydrated) return

    for (const announcement of announcements) {
      if (
        seenIds.has(announcement.id) ||
        surfacedRef.current.has(announcement.id)
      )
        continue
      surfacedRef.current.add(announcement.id)

      toast.info(announcement.title, {
        description: announcement.body,
        duration: Infinity,
        action: {
          label: "Dismiss",
          onClick: () => {
            void markSeen(announcement.id)
          },
        },
      })
    }
  }, [status, isHydrated, announcements, seenIds, markSeen])
}
