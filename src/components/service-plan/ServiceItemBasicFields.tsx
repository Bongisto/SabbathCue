import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ServiceItem, ServiceItemKind } from "@/types/service-plan"

const ITEM_KINDS: ServiceItemKind[] = [
  "general",
  "scripture",
  "hymn",
  "media",
  "slide",
  "announcement",
]

interface ServiceItemBasicFieldsProps {
  item: ServiceItem
  onPatchItem: (patch: Partial<ServiceItem>) => void
}

export function ServiceItemBasicFields({ item, onPatchItem }: ServiceItemBasicFieldsProps) {
  return (
    <div className="space-y-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
            Title
          </label>
          <Input value={item.title} onChange={(event) => onPatchItem({ title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
            Type
          </label>
          <Select
            value={item.kind}
            onValueChange={(kind) => onPatchItem({ kind: kind as ServiceItemKind })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kind.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Duration minutes
        </label>
        <Input
          type="number"
          min={0}
          value={item.durationMinutes ?? ""}
          onChange={(event) =>
            onPatchItem({
              durationMinutes: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        />
      </div>
    </div>
  )
}
