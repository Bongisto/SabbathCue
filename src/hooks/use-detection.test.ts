import { beforeEach, describe, expect, it, vi } from "vitest"

const invokeMock = vi.fn()
const reportOutputIssueMock = vi.fn()
const addDetectionsMock = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
  invokeTauri: (...args: unknown[]) => invokeMock(...args),
}))

vi.mock("@/stores/broadcast-store", () => ({
  useBroadcastStore: {
    getState: () => ({
      reportOutputIssue: reportOutputIssueMock,
    }),
  },
}))

vi.mock("@/stores/detection-store", () => ({
  useDetectionStore: {
    getState: () => ({
      addDetections: addDetectionsMock,
      clearDetections: vi.fn(),
      removeDetection: vi.fn(),
      detections: [],
    }),
  },
}))

describe("useDetection manual detection failures", () => {
  beforeEach(() => {
    invokeMock.mockReset()
    reportOutputIssueMock.mockReset()
    addDetectionsMock.mockReset()
    vi.resetModules()
  })

  it("reports a manual-detection issue and returns an empty result on failure", async () => {
    invokeMock.mockRejectedValueOnce(new Error("backend offline"))
    const { detectionActions } = await import("./use-detection")

    const results = await detectionActions.detectVerses("John 3:16")

    expect(results).toEqual([])
    expect(addDetectionsMock).not.toHaveBeenCalled()
    expect(reportOutputIssueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "global",
        kind: "manual-detection",
        title: "Detection failed",
      }),
    )
  })
})
