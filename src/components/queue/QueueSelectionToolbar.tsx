import { Trash2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function QueueSelectionToolbar({
  count,
  onDelete,
  onClear,
}: {
  count: number
  onDelete: () => void
  onClear: () => void
}) {
  if (count <= 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground">
        {count} selected
      </span>
      <Button
        type="button"
        size="xs"
        variant="destructive"
        onClick={onDelete}
      >
        <Trash2Icon className="size-3" />
        Delete
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={onClear}>
        <XIcon className="size-3" />
        Clear
      </Button>
    </div>
  )
}
