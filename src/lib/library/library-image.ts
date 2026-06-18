import { open } from "@tauri-apps/plugin-dialog"
import { invokeTauri } from "@/lib/tauri-runtime"

export const LIBRARY_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"]

export interface SavedLibraryImage {
  fileName: string
  width: number
  height: number
  mimeType: string
}

export async function pickLibraryImagePath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "Images",
        extensions: LIBRARY_IMAGE_EXTENSIONS,
      },
    ],
  })
  return typeof selected === "string" ? selected : null
}

export async function saveLibraryImage(path: string): Promise<SavedLibraryImage> {
  return invokeTauri<SavedLibraryImage>("save_library_image", { path })
}

export async function deleteLibraryImage(fileName: string): Promise<void> {
  await invokeTauri("delete_library_image", { fileName })
}

export async function readImageThumbnail(path: string): Promise<string> {
  return invokeTauri<string>("read_image_as_data_url", { path })
}
