import { Badge } from "@/components/ui/badge"
import { useSettingsStore } from "@/stores/settings-store"

function KeyStatus({ label, configured }: { label: string; configured: boolean }) {
  const sttProvider = useSettingsStore((state) => state.sttProvider)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {label} API Key
        </label>
        <Badge
          variant="outline"
          className={`text-[0.5rem] ${configured ? "" : "text-muted-foreground"}`}
        >
          {configured ? "Key configured" : "Not set"}
        </Badge>
      </div>
      <p className="text-[0.625rem] text-muted-foreground">
        {sttProvider === "vosk"
          ? "Not required when using local speech recognition. "
          : "Required when this cloud provider is selected. "}
        Configure and test it in the Speech Recognition section.
      </p>
    </div>
  )
}

export function ApiKeysSection() {
  const { hasDeepgramApiKey, hasSonioxApiKey, hasSpeechmaticsApiKey } =
    useSettingsStore()

  return (
    <div className="flex flex-col gap-6">
      <KeyStatus label="Deepgram" configured={hasDeepgramApiKey} />
      <KeyStatus label="Soniox" configured={hasSonioxApiKey} />
      <KeyStatus label="Speechmatics" configured={hasSpeechmaticsApiKey} />
    </div>
  )
}
