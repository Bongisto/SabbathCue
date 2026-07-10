import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { AssetCard } from "@/components/library/AssetCard"
import type { LibraryAsset } from "@/types/library"
import { LibraryIcon } from "lucide-react"

interface AssetGridProps {
  assets: LibraryAsset[]
  /** Picked asset ids in pick order; drives the numbered selection badges. */
  pickedIds?: string[]
  onSelectToggle?: (id: string) => void
}

export function AssetGrid({ assets, pickedIds, onSelectToggle }: AssetGridProps) {
  if (assets.length === 0) {
    return (
      <PanelEmptyState
        icon={<LibraryIcon className="size-8" />}
        title="No library assets"
        description="Import an image, save a theme, or create a song to start your local library."
      />
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {assets.map((asset) => {
        const pickIndex = pickedIds ? pickedIds.indexOf(asset.id) : -1
        return (
          <AssetCard
            key={asset.id}
            asset={asset}
            selectionIndex={pickIndex >= 0 ? pickIndex : null}
            onSelectToggle={onSelectToggle}
          />
        )
      })}
    </div>
  )
}
