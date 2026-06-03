import { cn } from "@/lib/utils"

export function WorkspaceFocusBanner({
  mode,
  className,
}: {
  mode: "design" | "settings"
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-primary/25 bg-primary/10 px-3 py-2 text-xs text-foreground transition-colors duration-150",
        className,
      )}
    >
      <span className="font-medium text-primary">
        {mode === "design" ? "Theme Designer" : "Settings"}
      </span>
      <span className="text-muted-foreground">
        {mode === "design"
          ? "Close the designer to return to your workspace."
          : "Close the dialog to return to your workspace."}
      </span>
    </div>
  )
}
