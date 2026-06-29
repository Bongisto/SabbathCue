import { callRpc } from "@/lib/supabase/rpc"

export interface ActiveAnnouncement {
  id: string
  title: string
  body: string
  published_at: string | null
  expires_at: string | null
}

export interface AdminAnnouncementRow {
  id: string
  title: string
  body: string
  status: "draft" | "published" | "expired"
  published_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type AnnouncementActionResult =
  | { ok: true }
  | { ok: false; message: string }

const ANNOUNCEMENTS_CATCH = "Unable to reach the announcements service."

function isActiveAnnouncement(value: unknown): value is ActiveAnnouncement {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.body === "string"
  )
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function isAdminAnnouncementStatus(
  value: unknown
): value is AdminAnnouncementRow["status"] {
  return value === "draft" || value === "published" || value === "expired"
}

function isAdminAnnouncementRow(value: unknown): value is AdminAnnouncementRow {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.body === "string" &&
    isAdminAnnouncementStatus(row.status) &&
    isNullableString(row.published_at) &&
    isNullableString(row.expires_at) &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string"
  )
}

export async function fetchActiveAnnouncements(): Promise<
  | { ok: true; announcements: ActiveAnnouncement[] }
  | { ok: false; message: string }
> {
  const result = await callRpc<unknown>("fetch_active_announcements", {
    errorFallback: "Could not load announcements.",
    catchFallback: ANNOUNCEMENTS_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  const announcements = Array.isArray(result.data)
    ? result.data.filter(isActiveAnnouncement)
    : []
  return { ok: true, announcements }
}

export async function adminListAnnouncements(): Promise<
  | { ok: true; announcements: AdminAnnouncementRow[] }
  | { ok: false; message: string }
> {
  const result = await callRpc<unknown>("admin_list_announcements", {
    errorFallback: "Could not load announcements.",
    catchFallback: ANNOUNCEMENTS_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  const announcements = Array.isArray(result.data)
    ? result.data.filter(isAdminAnnouncementRow)
    : []
  return { ok: true, announcements }
}

export async function adminCreateAnnouncement(
  title: string,
  body: string
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const result = await callRpc<unknown>("admin_create_announcement", {
    args: { p_title: title, p_body: body },
    errorFallback: "Could not create announcement.",
    catchFallback: ANNOUNCEMENTS_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  if (typeof result.data !== "string") {
    return { ok: false, message: "Unexpected create response." }
  }
  return { ok: true, id: result.data }
}

export async function adminUpdateAnnouncement(input: {
  id: string
  title?: string
  body?: string
  status?: AdminAnnouncementRow["status"]
  expiresAt?: string | null
}): Promise<AnnouncementActionResult> {
  const params: {
    p_id: string
    p_title?: string | null
    p_body?: string | null
    p_status?: AdminAnnouncementRow["status"] | null
    p_expires_at?: string | null
  } = { p_id: input.id }

  if ("title" in input) params.p_title = input.title ?? null
  if ("body" in input) params.p_body = input.body ?? null
  if ("status" in input) params.p_status = input.status ?? null
  if ("expiresAt" in input) params.p_expires_at = input.expiresAt ?? null

  const result = await callRpc<null>("admin_update_announcement", {
    args: params,
    errorFallback: "Could not update announcement.",
    catchFallback: ANNOUNCEMENTS_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true }
}

export async function adminDeleteAnnouncement(
  id: string
): Promise<AnnouncementActionResult> {
  const result = await callRpc<null>("admin_delete_announcement", {
    args: { p_id: id },
    errorFallback: "Could not delete announcement.",
    catchFallback: ANNOUNCEMENTS_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true }
}
