import { describe, expect, it } from "vitest"
import { collectionAssets, libraryAssetToServiceItem } from "./asset-to-service-item"
import type { LibraryAsset, LibraryCollection } from "@/types/library"

function imageAsset(id = "image-1"): LibraryAsset {
  return {
    id,
    name: "Welcome",
    type: "image",
    collectionIds: [],
    fileName: "welcome.png",
    width: 1920,
    height: 1080,
    mimeType: "image/png",
    thumbnail: "data:image/png;base64,x",
    createdAt: 1,
    updatedAt: 1,
  }
}

describe("library asset service-plan mapping", () => {
  it("maps an image asset to a media service item", () => {
    expect(libraryAssetToServiceItem(imageAsset())).toMatchObject({
      title: "Welcome",
      kind: "media",
      mediaRefs: [{ attachmentId: "image-1", label: "Welcome", path: "welcome.png" }],
      attachments: [
        {
          id: "image-1",
          kind: "slide",
          label: "Welcome",
          path: "welcome.png",
          status: "ready",
          mimeType: "image/png",
        },
      ],
    })
  })

  it("returns collection assets in collection order", () => {
    const first = imageAsset("first")
    const second = imageAsset("second")
    const collection: LibraryCollection = {
      id: "collection-1",
      name: "Sabbath",
      assetIds: ["second", "missing", "first"],
      createdAt: 1,
      updatedAt: 1,
    }

    expect(collectionAssets(collection, [first, second]).map((asset) => asset.id)).toEqual([
      "second",
      "first",
    ])
  })
})
