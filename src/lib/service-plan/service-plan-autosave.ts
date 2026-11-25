import type { ServicePlan } from "@/types/service-plan"

export interface ServicePlanAutosave {
  save(plan: ServicePlan, options?: { immediate?: boolean }): Promise<void>
  flush(): Promise<void>
  clear(): void
}

export function createServicePlanAutosave(
  persist: (plan: ServicePlan) => Promise<void>,
  getCurrentPlan: () => ServicePlan | null,
  debounceMs = 400,
): ServicePlanAutosave {
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let pendingPlan: ServicePlan | null = null

  async function safePersist(plan: ServicePlan): Promise<void> {
    try {
      await persist(plan)
    } catch (error) {
      console.warn("[service-plan] autosave persist failed", error)
    }
  }

  function resolvePlanToPersist(queued: ServicePlan | null): ServicePlan | null {
    const current = getCurrentPlan()
    if (queued && current?.id !== queued.id) {
      return queued
    }
    return current ?? queued
  }

  return {
    async save(plan, options) {
      if (options?.immediate) {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = null
        pendingPlan = null
        await safePersist(plan)
        return
      }

      pendingPlan = plan
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveTimer = null
        const queued = pendingPlan
        pendingPlan = null
        const latest = resolvePlanToPersist(queued)
        if (latest) void safePersist(latest)
      }, debounceMs)
    },

    async flush() {
      if (saveTimer === null) return
      clearTimeout(saveTimer)
      saveTimer = null
      const queued = pendingPlan
      pendingPlan = null
      const latest = resolvePlanToPersist(queued)
      if (latest) await safePersist(latest)
    },

    clear() {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = null
      pendingPlan = null
    },
  }
}
