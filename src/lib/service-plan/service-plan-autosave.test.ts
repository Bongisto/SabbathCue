import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServicePlanAutosave } from "./service-plan-autosave"
import { createPlanFromTemplate } from "./service-plan-templates"
import type { ServicePlan } from "@/types/service-plan"

describe("service-plan-autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("flushes pending debounced edits for the edited plan before switching plans", async () => {
    const planA = createPlanFromTemplate("prayer-meeting", "Plan A")!
    const planB = createPlanFromTemplate("prayer-meeting", "Plan B")!
    let activePlan: ServicePlan | null = planA
    const persist = vi.fn().mockResolvedValue(undefined)
    const autosave = createServicePlanAutosave(persist, () => activePlan, 400)

    const editedA = { ...planA, title: "Plan A Edited" }
    activePlan = editedA
    void autosave.save(editedA)

    await autosave.flush()
    activePlan = planB

    expect(persist).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ id: planA.id, title: "Plan A Edited" })
    )
  })

  it("catches persist rejections without throwing unhandled errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const plan = createPlanFromTemplate("prayer-meeting", "Plan A")!
    const persist = vi.fn().mockRejectedValue(new Error("Invalid service plan"))
    const autosave = createServicePlanAutosave(persist, () => plan, 400)

    void autosave.save(plan)
    await vi.advanceTimersByTimeAsync(400)

    expect(persist).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalled()
  })
})
