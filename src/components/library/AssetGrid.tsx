import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { AssetCard } from "@/components/library/AssetCard"
import type { LibraryAsset } from "@/types/library"
import { LibraryIcon } from "lucide-react"

interface AssetGridProps {
  assets: LibraryAsset[]
}

export function AssetGrid({ assets }: AssetGridProps) {
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
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  )
}
