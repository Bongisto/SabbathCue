export interface AudioOutputDevice {
  deviceId: string
  label: string
}

export async function listAudioOutputDevices(): Promise<AudioOutputDevice[]> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return []
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter((device) => device.kind === "audiooutput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Audio output ${index + 1}`,
      }))
  } catch {
    return []
  }
}

export function canSetAudioSink(): boolean {
  if (typeof document === "undefined") return false
  return "setSinkId" in document.createElement("video")
}
