// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AnnouncementsAdminPanel } from "./AnnouncementsAdminPanel"

const mockToastSuccess = vi.hoisted(() => vi.fn())
const mockToastError = vi.hoisted(() => vi.fn())
const mockAdminCreateAnnouncement = vi.hoisted(() => vi.fn())
const mockAdminDeleteAnnouncement = vi.hoisted(() => vi.fn())
const mockAdminListAnnouncements = vi.hoisted(() => vi.fn())
const mockAdminUpdateAnnouncement = vi.hoisted(() => vi.fn())

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

vi.mock("@/lib/supabase/announcements", () => ({
  adminCreateAnnouncement: (...args: unknown[]) =>
    mockAdminCreateAnnouncement(...args),
  adminDeleteAnnouncement: (...args: unknown[]) =>
    mockAdminDeleteAnnouncement(...args),
  adminListAnnouncements: (...args: unknown[]) =>
    mockAdminListAnnouncements(...args),
  adminUpdateAnnouncement: (...args: unknown[]) =>
    mockAdminUpdateAnnouncement(...args),
}))

const draftAnnouncement = {
  id: "a1",
  title: "Draft notice",
  body: "Remember rehearsal after service.",
  status: "draft" as const,
  published_at: null,
  expires_at: null,
  created_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-07-01T10:00:00.000Z",
}

const publishedAnnouncement = {
  ...draftAnnouncement,
  title: "Published notice",
  status: "published" as const,
  published_at: "2026-07-01T10:05:00.000Z",
}

describe("AnnouncementsAdminPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminListAnnouncements.mockResolvedValue({
      ok: true,
      announcements: [draftAnnouncement],
    })
    mockAdminCreateAnnouncement.mockResolvedValue({ ok: true, id: "new-id" })
    mockAdminUpdateAnnouncement.mockResolvedValue({ ok: true })
    mockAdminDeleteAnnouncement.mockResolvedValue({ ok: true })
  })

  afterEach(() => cleanup())

  it("loads announcement rows and publishes drafts through the admin RPC", async () => {
    render(<AnnouncementsAdminPanel />)

    expect(await screen.findByText("Draft notice")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Publish" }))

    await waitFor(() =>
      expect(mockAdminUpdateAnnouncement).toHaveBeenCalledWith({
        id: "a1",
        status: "published",
      })
    )
    expect(mockToastSuccess).toHaveBeenCalledWith("Announcement published.")
    await waitFor(() =>
      expect(mockAdminListAnnouncements).toHaveBeenCalledTimes(2)
    )
  })

  it("creates trimmed draft announcements and refreshes the list", async () => {
    render(<AnnouncementsAdminPanel />)

    await screen.findByText("Draft notice")
    fireEvent.change(screen.getByPlaceholderText("Title"), {
      target: { value: "  Sabbath lunch  " },
    })
    fireEvent.change(screen.getByPlaceholderText("Message body"), {
      target: { value: "  Bring plates.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }))

    await waitFor(() =>
      expect(mockAdminCreateAnnouncement).toHaveBeenCalledWith(
        "Sabbath lunch",
        "Bring plates."
      )
    )
    expect(mockToastSuccess).toHaveBeenCalledWith("Draft announcement created.")
    expect(
      (screen.getByPlaceholderText("Title") as HTMLInputElement).value
    ).toBe("")
    expect(
      (screen.getByPlaceholderText("Message body") as HTMLTextAreaElement).value
    ).toBe("")
    await waitFor(() =>
      expect(mockAdminListAnnouncements).toHaveBeenCalledTimes(2)
    )
  })

  it("expires and deletes published announcements through the admin RPCs", async () => {
    mockAdminListAnnouncements.mockResolvedValue({
      ok: true,
      announcements: [publishedAnnouncement],
    })

    render(<AnnouncementsAdminPanel />)

    expect(await screen.findByText("Published notice")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Expire" }))
    await waitFor(() =>
      expect(mockAdminUpdateAnnouncement).toHaveBeenCalledWith({
        id: "a1",
        status: "expired",
      })
    )
    expect(mockToastSuccess).toHaveBeenCalledWith("Announcement expired.")

    await screen.findByText("Published notice")
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Published notice" })
    )
    await waitFor(() =>
      expect(mockAdminDeleteAnnouncement).toHaveBeenCalledWith("a1")
    )
    expect(mockToastSuccess).toHaveBeenCalledWith("Announcement deleted.")
  })

  it("surfaces admin load errors", async () => {
    mockAdminListAnnouncements.mockResolvedValue({
      ok: false,
      message: "Admin access required",
    })

    render(<AnnouncementsAdminPanel />)

    expect(await screen.findByText("Admin access required")).toBeTruthy()
  })

  it("rejects empty draft input before calling the create RPC", async () => {
    render(<AnnouncementsAdminPanel />)

    await screen.findByText("Draft notice")
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }))

    expect(mockAdminCreateAnnouncement).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith("Title and body are required.")
  })
})
