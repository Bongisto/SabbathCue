// @vitest-environment jsdom
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useLibraryStore } from "@/stores/library-store"
import { AddAssetMenu } from "./AddAssetMenu"

const openMock = vi.fn()
const toastErrorMock = vi.fn()
const importPowerPointSlidesMock = vi.fn()
const pickLibraryVideoPathMock = vi.fn()
const validateLibraryVideoPathMock = vi.fn()
const readVideoMetadataMock = vi.fn()
const saveLibraryImageMock = vi.fn()

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

vi.mock("@/lib/powerpoint-import", () => ({
  POWERPOINT_EXTENSIONS: ["ppt", "pptx"],
  importPowerPointSlides: (...args: unknown[]) =>
    importPowerPointSlidesMock(...args),
}))

vi.mock("@/lib/library/library-image", () => ({
  saveLibraryImage: (...args: unknown[]) => saveLibraryImageMock(...args),
  readImageThumbnail: vi.fn().mockResolvedValue("data:image/png;base64,a"),
}))

vi.mock("@/lib/library/library-video", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/library/library-video")>()
  return {
    ...actual,
    pickLibraryVideoPath: (...args: unknown[]) =>
      pickLibraryVideoPathMock(...args),
    validateLibraryVideoPath: (...args: unknown[]) =>
      validateLibraryVideoPathMock(...args),
    readVideoMetadata: (...args: unknown[]) => readVideoMetadataMock(...args),
  }
})

vi.mock("@/lib/library/library-persistence", () => ({
  loadLibrarySnapshot: vi
    .fn()
    .mockResolvedValue({ assets: [], collections: [] }),
  saveLibrarySnapshot: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

describe("AddAssetMenu (FU-22)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLibraryStore.setState({ assets: [], collections: [] })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("shows toast.error when image, PowerPoint, video, or video URL imports reject", async () => {
    openMock.mockRejectedValueOnce(new Error("Image read failed"))
    render(<AddAssetMenu onCreateSong={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /import image/i }))
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Image read failed"),
    )

    openMock.mockResolvedValueOnce("/tmp/deck.pptx")
    importPowerPointSlidesMock.mockRejectedValueOnce(new Error("PPTX broken"))
    fireEvent.click(screen.getByRole("button", { name: /import powerpoint/i }))
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("PPTX broken"),
    )

    pickLibraryVideoPathMock.mockResolvedValueOnce("/tmp/clip.mp4")
    validateLibraryVideoPathMock.mockRejectedValueOnce(new Error("Bad video"))
    fireEvent.click(screen.getByRole("button", { name: /import video/i }))
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Bad video"),
    )

    vi.spyOn(window, "prompt").mockReturnValueOnce(
      "https://cdn.example.com/intro.webm?token=abc&v=1.0",
    )
    readVideoMetadataMock.mockRejectedValueOnce(new Error("Metadata error"))
    fireEvent.click(screen.getByRole("button", { name: /add video url/i }))
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Metadata error"),
    )
  })

  it("skips creating an empty asset when a PowerPoint has 0 slides", async () => {
    openMock.mockResolvedValueOnce("/tmp/empty.pptx")
    importPowerPointSlidesMock.mockResolvedValueOnce([])
    render(<AddAssetMenu onCreateSong={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /import powerpoint/i }))
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "No slides were found in that presentation.",
      ),
    )
    expect(useLibraryStore.getState().assets).toHaveLength(0)
  })

  it("derives video/webm MIME type and clean display name from URL pathname", async () => {
    vi.spyOn(window, "prompt").mockReturnValueOnce(
      "  https://cdn.example.com/media/intro%20clip.webm?token=abc&v=1.0  ",
    )
    readVideoMetadataMock.mockResolvedValueOnce({ durationMs: 5000 })
    render(<AddAssetMenu onCreateSong={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /add video url/i }))
    await waitFor(() =>
      expect(useLibraryStore.getState().assets).toHaveLength(1),
    )

    expect(useLibraryStore.getState().assets[0]).toMatchObject({
      type: "video",
      name: "intro clip",
      mimeType: "video/webm",
      url: "https://cdn.example.com/media/intro%20clip.webm?token=abc&v=1.0",
    })
  })
})
