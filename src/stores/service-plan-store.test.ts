import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPlanFromTemplate } from "@/lib/service-plan/service-plan-templates"

const syncActiveServiceItemPresentationsMock = vi.fn().mockResolvedValue(undefined)
const enqueuePreparedResourcesForItemMock = vi.fn().mockResolvedValue([])
const previewFirstContentForItemMock = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/service-plan/service-plan-live-effects", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/service-plan/service-plan-live-effects")>()
  return {
    ...actual,
    syncActiveServiceItemPresentations: (...args: unknown[]) =>
      syncActiveServiceItemPresentationsMock(...args),
    previewFirstContentForItem: (...args: unknown[]) =>
      previewFirstContentForItemMock(...args),
  }
})

vi.mock("@/lib/service-plan/prepare-queue-resources", () => ({
  enqueuePreparedResourcesForItem: (...args: unknown[]) =>
    enqueuePreparedResourcesForItemMock(...args),
}))

describe("service-plan-store presentation sync (FL-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("syncs presentations when starting live/practice with a pre-selected active item and on complete/skip", async () => {
    const plan = createPlanFromTemplate("prayer-meeting")!
    const [first, second, third] = plan.items
    plan.activeItemId = first.id

    const { useServicePlanStore } = await import("./service-plan-store")
    useServicePlanStore.setState({ activePlan: plan })

    await useServicePlanStore.getState().startPractice()
    expect(syncActiveServiceItemPresentationsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: first.id })
    )

    await useServicePlanStore.getState().startLiveService()
    expect(syncActiveServiceItemPresentationsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: first.id })
    )

    await useServicePlanStore.getState().completeActiveItem()
    expect(syncActiveServiceItemPresentationsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: second.id })
    )

    await useServicePlanStore.getState().skipActiveItem()
    expect(syncActiveServiceItemPresentationsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: third.id })
    )
  })
})

describe("service-plan-store autosave, hydration, and item targeting", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useFakeTimers()
    const { resetServicePlanRepositoryForTests } = await import(
      "@/lib/service-plan/service-plan-repository"
    )
    resetServicePlanRepositoryForTests()
  })

  it("flushes pending edits for the current plan before switching plans (FL-13)", async () => {
    const planA = createPlanFromTemplate("prayer-meeting", "Plan A")!
    const planB = createPlanFromTemplate("prayer-meeting", "Plan B")!
    const { servicePlanRepository, seedServicePlanRepositoryForTests } =
      await import("@/lib/service-plan/service-plan-repository")
    seedServicePlanRepositoryForTests(planA)
    seedServicePlanRepositoryForTests(planB)

    const { useServicePlanStore } = await import("./service-plan-store")
    await useServicePlanStore.getState().loadPlan(planA.id)

    useServicePlanStore.getState().updatePlanTitle("Plan A Updated")
    await useServicePlanStore.getState().loadPlan(planB.id)

    const persistedA = await servicePlanRepository.loadPlan(planA.id)
    expect(persistedA?.title).toBe("Plan A Updated")
    expect(useServicePlanStore.getState().activePlan?.id).toBe(planB.id)
    vi.useRealTimers()
  })

  it("skips persisting transiently blank plan or item titles without throwing (FU-26)", async () => {
    const plan = createPlanFromTemplate("prayer-meeting", "Valid Title")!
    const { servicePlanRepository, seedServicePlanRepositoryForTests } =
      await import("@/lib/service-plan/service-plan-repository")
    seedServicePlanRepositoryForTests(plan)
    const saveSpy = vi.spyOn(servicePlanRepository, "savePlan")

    const { useServicePlanStore } = await import("./service-plan-store")
    await useServicePlanStore.getState().loadPlan(plan.id)

    useServicePlanStore.getState().updatePlanTitle("")
    await vi.advanceTimersByTimeAsync(500)

    expect(saveSpy).not.toHaveBeenCalled()
    expect(useServicePlanStore.getState().activePlan?.title).toBe("")

    useServicePlanStore.getState().updatePlanTitle("Restored Title")
    await vi.advanceTimersByTimeAsync(500)

    expect(saveSpy).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it("recovers hydrationPromise and marks isHydrated after a repository failure (FL-14)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { servicePlanRepository } = await import(
      "@/lib/service-plan/service-plan-repository"
    )
    vi.spyOn(servicePlanRepository, "listSummaries")
      .mockRejectedValueOnce(new Error("store unreadable"))
      .mockResolvedValueOnce([])

    const { useServicePlanStore } = await import("./service-plan-store")
    await useServicePlanStore.getState().hydrate()

    expect(useServicePlanStore.getState().isHydrated).toBe(true)
    await expect(useServicePlanStore.getState().hydrate()).resolves.toBeUndefined()
    expect(servicePlanRepository.listSummaries).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
    vi.useRealTimers()
  })

  it("targets explicit itemId for enqueuePreparedResources and practicePreviewActiveItem (FU-32)", async () => {
    const plan = createPlanFromTemplate("prayer-meeting")!
    const [first, second] = plan.items
    plan.mode = "practice"
    plan.activeItemId = first.id

    const { useServicePlanStore } = await import("./service-plan-store")
    useServicePlanStore.setState({ activePlan: plan })

    await useServicePlanStore.getState().enqueuePreparedResources(second.id)
    expect(enqueuePreparedResourcesForItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: second.id })
    )

    await useServicePlanStore.getState().practicePreviewActiveItem(second.id)
    expect(previewFirstContentForItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: second.id })
    )
    vi.useRealTimers()
  })
})
