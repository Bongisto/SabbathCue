export async function downscaleImageToThumbnail(
  dataUrl: string,
  maxSize = 320,
): Promise<string> {
  const image = await loadImage(dataUrl)
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL("image/jpeg", 0.78)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not load thumbnail image"))
    image.src = src
  })
}
