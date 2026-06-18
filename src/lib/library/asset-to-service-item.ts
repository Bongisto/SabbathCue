import type { LibraryAsset, LibraryCollection } from "@/types/library"
import type { ServiceItem } from "@/types/service-plan"

export function libraryAssetToServiceItem(
  asset: LibraryAsset,
): Omit<ServiceItem, "id" | "order" | "status"> {
  const base = {
    title: asset.name,
    durationMinutes: undefined,
    notes: `Library asset: ${asset.type}`,
    scriptureRefs: [],
    hymnRefs: [],
    mediaRefs: [],
    attachments: [],
    checklist: [],
  }

  if (asset.type === "image") {
    return {
      ...base,
      kind: "media",
      mediaRefs: [
        {
          attachmentId: asset.id,
          label: asset.name,
          path: asset.fileName,
        },
      ],
      attachments: [
        {
          id: asset.id,
          kind: "slide",
          label: asset.name,
          path: asset.fileName,
          status: "ready",
          thumbnailUrl: asset.thumbnail,
          mimeType: asset.mimeType,
        },
      ],
    }
  }

  if (asset.type === "song") {
    return {
      ...base,
      kind: "hymn",
      hymnRefs: [{ title: asset.song.title }],
    }
  }

  if (asset.type === "slide-template") {
    return {
      ...base,
      kind: "slide",
      slideDeckIds: [asset.id],
    }
  }

  if (asset.type === "video") {
    return {
      ...base,
      kind: "media",
      mediaRefs: [
        {
          attachmentId: asset.id,
          label: asset.name,
          path: asset.filePath ?? asset.url ?? asset.youtubeId ?? "",
        },
      ],
      attachments: [
        {
          id: asset.id,
          kind: "media",
          label: asset.name,
          path: asset.filePath ?? asset.url ?? asset.youtubeId ?? "",
          status:
            asset.filePath || asset.url || asset.youtubeId ? "ready" : "failed",
          thumbnailUrl: asset.thumbnail,
          mimeType: asset.mimeType,
        },
      ],
    }
  }

  return {
    ...base,
    kind: "general",
    outputTemplateId: asset.theme.id,
  }
}

export function collectionAssets(
  collection: LibraryCollection,
  assets: LibraryAsset[],
): LibraryAsset[] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  return collection.assetIds.flatMap((id) => {
    const asset = byId.get(id)
    return asset ? [asset] : []
  })
}
