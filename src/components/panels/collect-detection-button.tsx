import { CheckIcon, FolderPlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getCollectedDetectionKey,
  useCollectedDetectionsStore,
} from "@/stores/collected-detections-store"
import type { DetectionResult } from "@/types"

export function CollectDetectionButton({
  detection,
  compact = false,
}: {
  detection: DetectionResult
  compact?: boolean
}) {
  const key = getCollectedDetectionKey(detection)
  const isCollected = useCollectedDetectionsStore((state) =>
    state.items.some((item) => item.key === key)
  )
  const record = useCollectedDetectionsStore((state) => state.record)

  return (
    <Button
      variant="outline"
      size={compact ? "xs" : "sm"}
      className="gap-1"
      disabled={isCollected}
      aria-label={
        isCollected
          ? `${detection.verse_ref} collected`
          : `Collect ${detection.verse_ref}`
      }
      onClick={() => record(detection)}
    >
      {isCollected ? (
        <CheckIcon className="size-3" />
      ) : (
        <FolderPlusIcon className="size-3" />
      )}
      {isCollected ? "Collected \u2713" : "Collect"}
    </Button>
  )
}
