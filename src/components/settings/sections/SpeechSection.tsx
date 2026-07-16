import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useAssets } from "@/hooks/use-assets"
import { useDeepgramKeySettings } from "@/hooks/use-deepgram-key-settings"
import { useSonioxKeySettings } from "@/hooks/use-soniox-key-settings"
import { useSpeechmaticsKeySettings } from "@/hooks/use-speechmatics-key-settings"
import {
  useSettingsStore,
  type SttLanguage,
  type SttProvider,
} from "@/stores/settings-store"
import {
  CheckCircle2Icon,
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  HardDriveIcon,
  Loader2Icon,
  ZapIcon,
} from "lucide-react"

function ProviderOption({
  value,
  activeProvider,
  title,
  description,
  recommended = false,
}: {
  value: SttProvider
  activeProvider: SttProvider
  title: string
  description: string
  recommended?: boolean
}) {
  return (
    <label
      data-recommended={recommended ? "true" : undefined}
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
        recommended
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
          : ""
      } ${
        activeProvider !== value && !recommended
          ? "hover:border-muted-foreground/25"
          : ""
      }`}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-foreground">{title}</span>
          {recommended ? (
            <Badge className="border-primary/40 bg-primary/15 text-primary">
              Best
            </Badge>
          ) : null}
        </div>
        <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </label>
  )
}

export function ProviderSelector({
  sttProvider,
  switchingStt,
  onProviderChange,
}: {
  sttProvider: SttProvider
  switchingStt: boolean
  onProviderChange: (provider: SttProvider) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Provider
      </label>

      <RadioGroup
        value={sttProvider}
        onValueChange={(v) => onProviderChange(v as SttProvider)}
        disabled={switchingStt}
        className="gap-3"
      >
        <ProviderOption
          value="deepgram"
          activeProvider={sttProvider}
          title="Cloud (Deepgram, optional paid)"
          description="Uses Deepgram Nova-3 for real-time streaming transcription. Requires an API key and internet connection. Best accuracy with keyword boosting for Bible terms."
        />
        <ProviderOption
          value="soniox"
          activeProvider={sttProvider}
          title="Cloud (Soniox, Afrikaans)"
          description="Uses Soniox stt-rt-v5 for real-time Afrikaans transcription with language_hints and endpoint detection. Requires an API key and internet connection."
          recommended
        />
        <ProviderOption
          value="speechmatics"
          activeProvider={sttProvider}
          title="Cloud (Speechmatics, multilingual)"
          description="Uses Speechmatics real-time partial and final transcripts. Supports Afrikaans, English, Spanish, French, Portuguese, and many more languages. Requires an API key and internet connection."
        />
        <ProviderOption
          value="vosk"
          activeProvider={sttProvider}
          title="Local (Vosk)"
          description="Uses a verse-focused constrained grammar for fast Bible reference detection. Free after the model is installed, and audio never leaves your machine. For full-sermon transcript quality, use Deepgram."
        />
      </RadioGroup>
    </div>
  )
}

function VoskModelStatus({
  assetsLoading,
  voskReady,
  voskModelName,
  voskModelQuality,
  voskMissingMessage,
  hasModel,
  onRefresh,
}: {
  assetsLoading: boolean
  voskReady: boolean
  voskModelName: string | null
  voskModelQuality: string | null
  voskMissingMessage: string | null
  hasModel: boolean
  onRefresh: () => void
}) {
  const badgeText = assetsLoading
    ? "Checking"
    : voskReady
      ? voskModelQuality || "Installed"
      : "Missing"

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDriveIcon className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            Local model status
          </span>
        </div>
        <Badge variant="outline" className="text-[0.5rem]">
          {badgeText}
        </Badge>
      </div>

      <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
        Vosk runs with a verse-focused constrained grammar. For better offline
        recognition, install{" "}
        <code className="text-[0.5625rem]">vosk-model-en-us-0.22-lgraph</code>.
        The smaller{" "}
        <code className="text-[0.5625rem]">vosk-model-small-en-us</code> model
        remains supported as a fallback. Development builds using the Python
        worker also need the <code className="text-[0.5625rem]">vosk</code>{" "}
        package installed. Place the model folder here or set{" "}
        <code className="text-[0.5625rem]">SABBATHCUE_VOSK_MODEL_DIR</code>.
      </p>
      {!assetsLoading && voskModelName ? (
        <p className="rounded-md bg-[var(--shell-code-bg)] px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
          Active model: {voskModelName}
        </p>
      ) : null}
      {!assetsLoading && voskMissingMessage ? (
        <p className="rounded-md bg-[var(--shell-code-bg)] px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
          {voskMissingMessage}
        </p>
      ) : null}
      {!assetsLoading && !hasModel ? (
        <p className="rounded-md bg-[var(--shell-code-bg)] px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
          models\vosk\vosk-model-en-us-0.22-lgraph
        </p>
      ) : null}

      <Button
        size="sm"
        variant="outline"
        onClick={() => void onRefresh()}
        className="w-fit text-xs"
      >
        <DownloadIcon className="size-3" />
        Refresh asset status
      </Button>
    </div>
  )
}

type KeySettings = {
  hasApiKey: boolean
  keyValue: string
  setKeyValue: (value: string) => void
  editingSavedKey: boolean
  setEditingSavedKey: (value: boolean) => void
  saved: boolean
  keyError: string | null
  displayedKeyValue: string
  keyActionLabel: string
  handleKeyAction: () => Promise<void>
  handleClearKey: () => Promise<void>
  validating: boolean
  keyVerified: boolean
  validationMessage: string | null
  handleValidateKey: () => Promise<void>
}

function voskMissingMessageFor(
  status: ReturnType<typeof useAssets>["status"]
): string | null {
  if (status?.vosk_model && status?.vosk_worker && status?.vosk_runtime)
    return null
  if (!status?.vosk_model) {
    return "Vosk model files are missing from the app resources or configured model path."
  }
  if (!status?.vosk_worker) {
    return "Vosk worker script is missing from the app resources."
  }
  return (
    status?.vosk_runtime_error ||
    "Python is available, but the Vosk package could not be loaded."
  )
}

function deepgramKeyAdapter(
  settings: ReturnType<typeof useDeepgramKeySettings>
): KeySettings {
  return {
    hasApiKey: settings.hasDeepgramApiKey,
    keyValue: settings.keyValue,
    setKeyValue: settings.setKeyValue,
    editingSavedKey: settings.editingSavedKey,
    setEditingSavedKey: settings.setEditingSavedKey,
    saved: settings.saved,
    keyError: settings.keyError,
    displayedKeyValue: settings.displayedKeyValue,
    keyActionLabel: settings.keyActionLabel,
    handleKeyAction: settings.handleKeyAction,
    handleClearKey: settings.handleClearKey,
    validating: settings.validating,
    keyVerified: settings.keyVerified,
    validationMessage: settings.validationMessage,
    handleValidateKey: settings.handleValidateKey,
  }
}

function ProviderKeySettings({
  providerName,
  signupUrl,
  steps,
  cost,
  pricingUrl,
  settings,
}: {
  providerName: string
  signupUrl: string
  steps: string[]
  cost: string
  pricingUrl: string
  settings: KeySettings
}) {
  const inputType =
    settings.hasApiKey && !settings.editingSavedKey && !settings.keyValue
      ? "text"
      : "password"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {providerName} API Key
        </label>
        {settings.hasApiKey ? (
          <Badge variant="outline" className="gap-1 text-[0.5rem]">
            {settings.keyVerified ? (
              <CheckCircle2Icon className="size-2.5 text-emerald-500" />
            ) : null}
            {settings.keyVerified ? "Key verified" : "Key configured"}
          </Badge>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          type={inputType}
          placeholder={`Enter your ${providerName} API key...`}
          value={settings.displayedKeyValue}
          readOnly={
            settings.hasApiKey &&
            !settings.editingSavedKey &&
            !settings.keyValue
          }
          onChange={(e) => {
            settings.setEditingSavedKey(true)
            settings.setKeyValue(e.target.value)
          }}
          className="flex-1 text-xs"
        />
        <Button size="sm" onClick={() => void settings.handleKeyAction()}>
          {settings.saved ? (
            <>
              <CheckIcon className="size-3" />
              Saved
            </>
          ) : (
            settings.keyActionLabel
          )}
        </Button>
        {settings.hasApiKey ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void settings.handleClearKey()}
          >
            Remove
          </Button>
        ) : null}
        {settings.hasApiKey ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={settings.validating}
            onClick={() => void settings.handleValidateKey()}
          >
            {settings.validating ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <CheckCircle2Icon className="size-3" />
            )}
            {settings.validating ? "Testing" : "Test key"}
          </Button>
        ) : null}
      </div>
      {settings.keyError ? (
        <p className="text-[0.625rem] text-red-500">{settings.keyError}</p>
      ) : null}
      {settings.validationMessage ? (
        <p
          className={`text-[0.625rem] ${
            settings.keyVerified ? "text-emerald-600" : "text-red-500"
          }`}
          role="status"
        >
          {settings.validationMessage}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5 text-[0.625rem] text-muted-foreground">
        <p>
          Required for live transcription. Get a key at{" "}
          <a
            href={signupUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
          >
            Open {providerName} console
            <ExternalLinkIcon className="size-2.5" />
          </a>
          :
        </p>
        <ol className="ml-3 flex list-decimal flex-col gap-0.5">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          Cost: {cost} Current rates at{" "}
          <a
            href={pricingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
          >
            View current pricing
            <ExternalLinkIcon className="size-2.5" />
          </a>
          .
        </p>
      </div>
    </div>
  )
}

const CLOUD_LANGUAGE_OPTIONS: Record<
  "deepgram" | "soniox" | "speechmatics",
  { value: SttLanguage; label: string }[]
> = {
  deepgram: [
    { value: "en", label: "English (en)" },
    { value: "es", label: "Spanish (es)" },
    { value: "fr", label: "French (fr)" },
    { value: "pt", label: "Portuguese (pt)" },
  ],
  soniox: [
    { value: "en", label: "English (en)" },
    { value: "af", label: "Afrikaans (af)" },
    { value: "es", label: "Spanish (es)" },
    { value: "fr", label: "French (fr)" },
    { value: "pt", label: "Portuguese (pt)" },
  ],
  speechmatics: [
    { value: "en", label: "English (en)" },
    { value: "af", label: "Afrikaans (af)" },
    { value: "es", label: "Spanish (es)" },
    { value: "fr", label: "French (fr)" },
    { value: "pt", label: "Portuguese (pt)" },
  ],
}

function CloudLanguageSelector({
  provider,
  sttLanguage,
  switchingStt,
}: {
  provider: "deepgram" | "soniox" | "speechmatics"
  sttLanguage: SttLanguage
  switchingStt: boolean
}) {
  const options = CLOUD_LANGUAGE_OPTIONS[provider]
  const value = options.some((option) => option.value === sttLanguage)
    ? sttLanguage
    : "en"

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Transcription language
      </label>
      <RadioGroup
        value={value}
        onValueChange={(value) =>
          useSettingsStore.getState().setSttLanguage(value as SttLanguage)
        }
        disabled={switchingStt}
        className="gap-2"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs"
          >
            <RadioGroupItem value={option.value} />
            {option.label}
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}

function PerformanceSetting({ lowPowerMode }: { lowPowerMode: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Performance
      </label>
      <label
        data-testid="low-power-mode"
        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
      >
        <div className="flex items-start gap-3">
          <ZapIcon className="mt-0.5 size-3.5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">
              Low power mode
            </span>
            <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
              Reduces CPU and memory use on weaker machines. Paraphrase
              detection runs only on finished sentences instead of live partial
              speech; spoken references like &quot;John 3:16&quot; are still
              detected instantly. Takes effect the next time transcription
              starts.
            </p>
          </div>
        </div>
        <Switch
          checked={lowPowerMode}
          onCheckedChange={(checked) =>
            useSettingsStore.getState().setLowPowerMode(checked)
          }
        />
      </label>
    </div>
  )
}

export function SpeechSection() {
  const lowPowerMode = useSettingsStore((s) => s.lowPowerMode)
  const sttLanguage = useSettingsStore((s) => s.sttLanguage)
  const deepgramKeySettings = useDeepgramKeySettings()
  const { sttProvider, switchingStt, handleProviderChange } =
    deepgramKeySettings
  const sonioxKeySettings = useSonioxKeySettings(handleProviderChange)
  const speechmaticsKeySettings =
    useSpeechmaticsKeySettings(handleProviderChange)

  const {
    status: assetStatus,
    loading: assetsLoading,
    refresh: refreshAssets,
  } = useAssets()

  const voskReady = Boolean(
    assetStatus?.vosk_model &&
    assetStatus?.vosk_worker &&
    assetStatus?.vosk_runtime
  )
  const voskModelName = assetStatus?.vosk_model_name ?? null
  const voskModelQuality = assetStatus?.vosk_model_quality ?? null
  const voskMissingMessage = voskMissingMessageFor(assetStatus)

  return (
    <div className="flex flex-col gap-6">
      <ProviderSelector
        sttProvider={sttProvider}
        switchingStt={switchingStt}
        onProviderChange={handleProviderChange}
      />

      {sttProvider === "vosk" && (
        <VoskModelStatus
          assetsLoading={assetsLoading}
          voskReady={voskReady}
          voskModelName={voskModelName}
          voskModelQuality={voskModelQuality}
          voskMissingMessage={voskMissingMessage}
          hasModel={Boolean(assetStatus?.vosk_model)}
          onRefresh={refreshAssets}
        />
      )}

      {sttProvider === "deepgram" && (
        <>
          <CloudLanguageSelector
            provider="deepgram"
            sttLanguage={sttLanguage}
            switchingStt={switchingStt}
          />
          <ProviderKeySettings
            providerName="Deepgram"
            signupUrl="https://console.deepgram.com"
            steps={[
              "Sign up or sign in, select your project, then open Settings → API Keys.",
              "Choose Create a New API Key. Name it SabbathCue, use the least-privileged transcription role offered, and choose an expiration you can maintain.",
              "Create and copy the secret now — Deepgram shows it only once.",
              "Paste it above, save it securely, then select Test key.",
            ]}
            cost="Free signup currently includes introductory credit; paid usage is billed in USD."
            pricingUrl="https://deepgram.com/pricing"
            settings={deepgramKeyAdapter(deepgramKeySettings)}
          />
        </>
      )}

      {sttProvider === "soniox" && (
        <>
          <CloudLanguageSelector
            provider="soniox"
            sttLanguage={sttLanguage}
            switchingStt={switchingStt}
          />
          <ProviderKeySettings
            providerName="Soniox"
            signupUrl="https://console.soniox.com"
            steps={[
              "Sign up or sign in, open My First Project, then select API Keys.",
              "Generate a new API key and copy the complete key while it is visible.",
              "Paste it above, save it securely, then select Test key.",
            ]}
            cost="Pay-as-you-go streaming; review the provider's current allowance and rates before use."
            pricingUrl="https://soniox.com/pricing"
            settings={{
              hasApiKey: sonioxKeySettings.hasSonioxApiKey,
              keyValue: sonioxKeySettings.keyValue,
              setKeyValue: sonioxKeySettings.setKeyValue,
              editingSavedKey: sonioxKeySettings.editingSavedKey,
              setEditingSavedKey: sonioxKeySettings.setEditingSavedKey,
              saved: sonioxKeySettings.saved,
              keyError: sonioxKeySettings.keyError,
              displayedKeyValue: sonioxKeySettings.displayedKeyValue,
              keyActionLabel: sonioxKeySettings.keyActionLabel,
              handleKeyAction: sonioxKeySettings.handleKeyAction,
              handleClearKey: sonioxKeySettings.handleClearKey,
              validating: sonioxKeySettings.validating,
              keyVerified: sonioxKeySettings.keyVerified,
              validationMessage: sonioxKeySettings.validationMessage,
              handleValidateKey: sonioxKeySettings.handleValidateKey,
            }}
          />
        </>
      )}

      {sttProvider === "speechmatics" && (
        <>
          <CloudLanguageSelector
            provider="speechmatics"
            sttLanguage={sttLanguage}
            switchingStt={switchingStt}
          />
          <ProviderKeySettings
            providerName="Speechmatics"
            signupUrl="https://portal.speechmatics.com"
            steps={[
              "Create a free Speechmatics account or sign in to the Portal.",
              "Open API Keys from your project or account navigation and generate a key named SabbathCue.",
              "Copy the complete key and keep it private.",
              "Paste it above, save it securely, then select Test key.",
            ]}
            cost="A free monthly real-time allowance is currently available; paid usage follows the provider's current rates."
            pricingUrl="https://www.speechmatics.com/pricing"
            settings={{
              hasApiKey: speechmaticsKeySettings.hasSpeechmaticsApiKey,
              keyValue: speechmaticsKeySettings.keyValue,
              setKeyValue: speechmaticsKeySettings.setKeyValue,
              editingSavedKey: speechmaticsKeySettings.editingSavedKey,
              setEditingSavedKey:
                speechmaticsKeySettings.setEditingSavedKey,
              saved: speechmaticsKeySettings.saved,
              keyError: speechmaticsKeySettings.keyError,
              displayedKeyValue: speechmaticsKeySettings.displayedKeyValue,
              keyActionLabel: speechmaticsKeySettings.keyActionLabel,
              handleKeyAction: speechmaticsKeySettings.handleKeyAction,
              handleClearKey: speechmaticsKeySettings.handleClearKey,
              validating: speechmaticsKeySettings.validating,
              keyVerified: speechmaticsKeySettings.keyVerified,
              validationMessage: speechmaticsKeySettings.validationMessage,
              handleValidateKey: speechmaticsKeySettings.handleValidateKey,
            }}
          />
        </>
      )}

      <PerformanceSetting lowPowerMode={lowPowerMode} />
    </div>
  )
}
