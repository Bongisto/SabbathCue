import { create } from "zustand"
import {
  addServiceItem,
  completeCurrentServiceItem,
  completeServicePlan,
  deleteServiceItem,
  duplicateServiceItem,
  reorderServiceItems,
  setActiveServiceItem,
  setServiceItemReady,
  skipCurrentServiceItem,
  startLiveServiceMode,
  startPracticeMode,
  updateServiceItem,
} from "@/lib/service-plan/service-plan-actions"
import { createServicePlanAutosave } from "@/lib/service-plan/service-plan-autosave"
import {
  previewFirstContentForItem,
  releaseAllServiceMedia,
  releaseCompletedItemMedia,
  syncActiveServiceItemPresentations,
  syncServiceContext,
} from "@/lib/service-plan/service-plan-live-effects"
import { servicePlanRepository } from "@/lib/service-plan/service-plan-repository"
import { createPlanFromTemplate } from "@/lib/service-plan/service-plan-templates"
import {
  findNextServiceItem,
  isValidServicePlan,
  normalizeItemOrder,
} from "@/lib/service-plan/service-plan-validation"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import type {
  ServiceContext,
  ServiceItem,
  ServicePlan,
  ServicePlanReport,
  ServicePlanSummary,
} from "@/types/service-plan"

interface ServicePlanState {
  summaries: ServicePlanSummary[]
  activePlan: ServicePlan | null
  serviceContext: ServiceContext
  plannerOpen: boolean
  isHydrated: boolean
  isSaving: boolean
  pendingReport: boolean
  lastReport: ServicePlanReport | null

  hydrate: () => Promise<void>
  openPlanner: () => void
  closePlanner: () => void
  createFromTemplate: (templateId: string, title?: string) => Promise<void>
  loadPlan: (id: string) => Promise<void>
  savePlan: (options?: { immediate?: boolean }) => Promise<void>
  updatePlanTitle: (title: string) => void
  addItem: (item: Omit<ServiceItem, "id" | "order" | "status">) => void
  updateItem: (itemId: string, patch: Partial<ServiceItem>) => void
  deleteItem: (itemId: string) => void
  duplicateItem: (itemId: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  setActiveItem: (itemId: string | null) => Promise<void>
  markItemReady: (itemId: string) => void
  completeActiveItem: () => Promise<void>
  skipActiveItem: () => Promise<void>
  goToNextItem: () => Promise<void>
  goToPreviousItem: () => Promise<void>
  startPractice: () => Promise<void>
  startLiveService: () => Promise<void>
  completeService: () => Promise<void>
  enqueuePreparedResources: (itemId?: string) => Promise<void>
  practicePreviewActiveItem: (itemId?: string) => Promise<void>
  generatePostServiceReport: () => Promise<void>
}

let hydrationPromise: Promise<void> | null = null

async function persistPlan(plan: ServicePlan): Promise<void> {
  if (!isValidServicePlan(plan)) return
  useServicePlanStore.setState({ isSaving: true })
  try {
    await servicePlanRepository.savePlan(plan)
    const summaries = await servicePlanRepository.listSummaries()
    useServicePlanStore.setState({ summaries })
  } catch (error) {
    console.warn("[service-plan] failed to persist plan", error)
  } finally {
    useServicePlanStore.setState({ isSaving: false })
  }
}

const autosave = createServicePlanAutosave(
  persistPlan,
  () => useServicePlanStore.getState().activePlan
)

function setActivePlan(next: ServicePlan | null): void {
  useServicePlanStore.setState({
    activePlan: next,
    serviceContext: syncServiceContext(next),
  })
}

function patchActivePlan(
  updater: (plan: ServicePlan) => ServicePlan,
  options?: {
    immediate?: boolean
    statePatch?: Partial<
      Pick<ServicePlanState, "pendingReport" | "lastReport">
    >
  }
): void {
  const current = useServicePlanStore.getState().activePlan
  if (!current) return

  const next = updater({ ...current, updatedAt: Date.now() })
  useServicePlanStore.setState({
    activePlan: next,
    serviceContext: syncServiceContext(next),
    ...options?.statePatch,
  })
  void autosave.save(next, options)
}

async function syncCurrentActiveItem(plan: ServicePlan | null): Promise<void> {
  if (!plan || plan.mode === "planning") return
  const active = plan.activeItemId
    ? (plan.items.find((item) => item.id === plan.activeItemId) ?? null)
    : null
  await syncActiveServiceItemPresentations(active)
}

export const useServicePlanStore = create<ServicePlanState>((set, get) => ({
  summaries: [],
  activePlan: null,
  serviceContext: syncServiceContext(null),
  plannerOpen: false,
  isHydrated: false,
  isSaving: false,
  pendingReport: false,
  lastReport: null,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise
    hydrationPromise = (async () => {
      try {
        const summaries = await servicePlanRepository.listSummaries()
        set({ summaries, isHydrated: true })
      } catch (error) {
        console.warn("[service-plan] failed to hydrate service plans", error)
        set({ isHydrated: true })
        hydrationPromise = null
      }
    })()
    return hydrationPromise
  },

  openPlanner: () => set({ plannerOpen: true }),
  closePlanner: () => set({ plannerOpen: false }),

  createFromTemplate: async (templateId, title) => {
    const plan = createPlanFromTemplate(templateId, title)
    if (!plan) return
    await autosave.flush()
    await servicePlanRepository.savePlan(plan)
    const summaries = await servicePlanRepository.listSummaries()
    set({ summaries, plannerOpen: true })
    setActivePlan(plan)
  },

  loadPlan: async (id) => {
    await autosave.flush()
    const plan = await servicePlanRepository.loadPlan(id)
    if (!plan) return
    set({ plannerOpen: true })
    setActivePlan(plan)
  },

  savePlan: async (options) => {
    const plan = get().activePlan
    if (!plan) return
    await autosave.save(plan, options)
  },

  updatePlanTitle: (title) => {
    patchActivePlan((plan) => ({ ...plan, title }))
  },

  addItem: (item) => {
    patchActivePlan((plan) => addServiceItem(plan, item))
  },

  updateItem: (itemId, patch) => {
    patchActivePlan((plan) => updateServiceItem(plan, itemId, patch))
  },

  deleteItem: (itemId) => {
    patchActivePlan((plan) => deleteServiceItem(plan, itemId))
  },

  duplicateItem: (itemId) => {
    patchActivePlan((plan) => duplicateServiceItem(plan, itemId))
  },

  reorderItems: (fromIndex, toIndex) => {
    patchActivePlan((plan) => reorderServiceItems(plan, fromIndex, toIndex))
  },

  setActiveItem: async (itemId) => {
    patchActivePlan((plan) => setActiveServiceItem(plan, itemId), {
      immediate: true,
    })
    await syncCurrentActiveItem(get().activePlan)
  },

  markItemReady: (itemId) => {
    patchActivePlan((plan) => setServiceItemReady(plan, itemId))
  },

  completeActiveItem: async () => {
    const completed = get().activePlan?.items.find(
      (item) => item.id === get().activePlan?.activeItemId
    )
    patchActivePlan((plan) => completeCurrentServiceItem(plan), {
      immediate: true,
    })
    releaseCompletedItemMedia(completed)
    await syncCurrentActiveItem(get().activePlan)
  },

  skipActiveItem: async () => {
    patchActivePlan((plan) => skipCurrentServiceItem(plan), { immediate: true })
    await syncCurrentActiveItem(get().activePlan)
  },

  goToNextItem: async () => {
    const plan = get().activePlan
    if (!plan) return
    const next = findNextServiceItem(plan.items, plan.activeItemId)
    if (next) await get().setActiveItem(next.id)
  },

  goToPreviousItem: async () => {
    const plan = get().activePlan
    if (!plan?.activeItemId) return
    const ordered = normalizeItemOrder(plan.items)
    const index = ordered.findIndex((item) => item.id === plan.activeItemId)
    if (index > 0) await get().setActiveItem(ordered[index - 1].id)
  },

  startPractice: async () => {
    patchActivePlan(startPracticeMode, { immediate: true })

    const plan = get().activePlan
    if (plan && !plan.activeItemId) {
      const first = findNextServiceItem(plan.items, null)
      if (first) {
        await get().setActiveItem(first.id)
        return
      }
    }
    await syncCurrentActiveItem(get().activePlan)
  },

  startLiveService: async () => {
    patchActivePlan(startLiveServiceMode, { immediate: true })

    useDashboardWorkspaceStore.getState().setWorkspace("run-service")
    get().closePlanner()

    const plan = get().activePlan
    if (plan && !plan.activeItemId) {
      const first = findNextServiceItem(plan.items, null)
      if (first) {
        await get().setActiveItem(first.id)
        return
      }
    }
    await syncCurrentActiveItem(get().activePlan)
  },

  completeService: async () => {
    patchActivePlan(completeServicePlan, {
      immediate: true,
      statePatch: { pendingReport: true },
    })
    releaseAllServiceMedia()
  },

  enqueuePreparedResources: async (itemId) => {
    const plan = get().activePlan
    const targetId = itemId ?? plan?.activeItemId
    const target = targetId
      ? plan?.items.find((item) => item.id === targetId)
      : undefined
    if (!target) return
    const { enqueuePreparedResourcesForItem } =
      await import("@/lib/service-plan/prepare-queue-resources")
    await enqueuePreparedResourcesForItem(target)
  },

  practicePreviewActiveItem: async (itemId) => {
    const plan = get().activePlan
    if (!plan || plan.mode !== "practice") return
    const targetId = itemId ?? plan.activeItemId
    const target = targetId
      ? plan.items.find((item) => item.id === targetId)
      : undefined
    if (target) await previewFirstContentForItem(target)
  },

  generatePostServiceReport: async () => {
    const plan = get().activePlan
    if (!plan) return
    const { generateServicePlanReport } =
      await import("@/lib/service-plan/service-plan-report")
    const report = generateServicePlanReport(plan)
    patchActivePlan(
      (current) => ({ ...current, reportGeneratedAt: report.generatedAt }),
      {
        immediate: true,
        statePatch: { pendingReport: false, lastReport: report },
      }
    )
  },
}))

export function hydrateServicePlans(): Promise<void> {
  return useServicePlanStore.getState().hydrate()
}

export function getServiceContext(): ServiceContext {
  return useServicePlanStore.getState().serviceContext
}
