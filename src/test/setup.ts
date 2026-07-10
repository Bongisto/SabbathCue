;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

// @dnd-kit/dom instantiates a ResizeObserver at import time; jsdom has none.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as typeof globalThis & { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub
}
