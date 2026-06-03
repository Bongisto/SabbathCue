import { useCallback, useEffect, useRef } from "react"

type PointerMoveHandler = (event: PointerEvent) => void
type PointerUpHandler = (event: PointerEvent) => void

export function useWindowPointerDragCleanup() {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  return useCallback(
    (onMove: PointerMoveHandler, onUp?: PointerUpHandler) => {
      cleanupRef.current?.()

      const handleUp = (event: PointerEvent) => {
        onUp?.(event)
        cleanup()
      }

      function cleanup() {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", handleUp)
        if (cleanupRef.current === cleanup) {
          cleanupRef.current = null
        }
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", handleUp)
      cleanupRef.current = cleanup
    },
    [],
  )
}
