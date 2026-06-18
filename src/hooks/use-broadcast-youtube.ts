import { useEffect, useMemo } from "react"

export function useYoutubeEmbedUrl(youtubeId: string | undefined): string | null {
  return useMemo(() => {
    if (!youtubeId) return null
    const params = new URLSearchParams({
      autoplay: "1",
      controls: "0",
      modestbranding: "1",
      rel: "0",
      playsinline: "1",
    })
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`
  }, [youtubeId])
}

export function useBroadcastYoutube(
  iframe: HTMLIFrameElement | null,
  active: boolean,
): void {
  useEffect(() => {
    if (!iframe || active) return
    iframe.removeAttribute("src")
  }, [active, iframe])
}
