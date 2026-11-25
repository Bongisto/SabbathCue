import { APP_DISPLAY_NAME } from "./app-brand";
import { publicSiteOrigin } from "./site-url";
import { getWindowsInstallerDownloadConfig } from "./windows-installer-download";

const windowsInstaller = getWindowsInstallerDownloadConfig();
const REPO_URL = "https://github.com/Bongisto/SabbathCue";

export function publicBasePath(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_PATH !== undefined
      ? process.env.NEXT_PUBLIC_BASE_PATH.trim()
      : "/SabbathCue";
  const normalized = raw.replace(/\/+$/, "");
  if (!normalized) return "";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export const SITE = {
  name: APP_DISPLAY_NAME,
  legalName: "BongaNdlovu",
  tagline: "Your Pastor speaks. SabbathCue finds the verse.",
  shortDescription:
    "Real-time AI Bible and Ellen G. White verse detection for live sermons. Offline-first, voice-controlled, broadcast-ready via NDI and HDMI projector.",
  description:
    "SabbathCue listens to a live sermon audio feed, transcribes speech in real time (offline with Vosk or via cloud STT), detects Bible and Ellen G. White references with hybrid semantic AI search, and renders them as broadcast-ready overlays via NDI and direct HDMI projector outputs.",
  url: publicSiteOrigin(),
  repoUrl: REPO_URL,
  locale: "en_US",
  twitterHandle: "",
  founded: "2025",
  category: "ChurchSoftware",
  operatingSystems: ["Windows", "macOS"],
  repo: {
    owner: "Bongisto",
    name: "SabbathCue",
    url: REPO_URL,
    releasesLatest: "https://github.com/Bongisto/sabbathcue-releases/releases/latest",
    download: windowsInstaller.url,
    downloadFilename: windowsInstaller.saveAsFilename,
    installerVersion: windowsInstaller.version,
    discussions: "https://github.com/Bongisto/SabbathCue/discussions",
    stars: { fallback: 0 },
  },
  socials: {
    github: REPO_URL,
  },
  stats: {
    languages: "5+",
    translations: "10+",
  },
} as const;

export async function getGitHubStars(): Promise<number> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(
      `https://api.github.com/repos/${SITE.repo.owner}/${SITE.repo.name}`,
      { headers }
    );
    if (!res.ok) return SITE.repo.stars.fallback;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : SITE.repo.stars.fallback;
  } catch {
    return SITE.repo.stars.fallback;
  }
}
