use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

const BLOCKED_UNIX_PREFIXES: &[&str] = &[
    "/etc",
    "/bin",
    "/sbin",
    "/usr",
    "/var",
    "/proc",
    "/dev",
    "/sys",
    "/root",
    "/system",
    "/library",
    "/private/etc",
    "/private/var",
];

const BLOCKED_WINDOWS_SUBDIRS: &[&str] = &[
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
];

pub fn has_url_scheme(path: &str) -> bool {
    let Some(colon_idx) = path.find(':') else {
        return false;
    };
    if colon_idx == 0 {
        return false;
    }
    let scheme = &path[..colon_idx];
    let rest = &path[colon_idx + 1..];
    // Windows drive letter (e.g. C:\ or C:/) is not a URL scheme.
    if scheme.len() == 1
        && scheme.chars().all(|ch| ch.is_ascii_alphabetic())
        && rest.starts_with(['\\', '/'])
    {
        return false;
    }
    let first = scheme.chars().next().unwrap_or_default();
    if !first.is_ascii_alphabetic() {
        return false;
    }
    scheme
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
}

pub fn is_network_path(path: &str) -> bool {
    path.starts_with("\\\\") || path.starts_with("//")
}

fn strip_windows_verbatim_prefix(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    if let Some(rest) = normalized
        .strip_prefix("//?/")
        .or_else(|| normalized.strip_prefix("//./"))
    {
        if rest
            .get(..4)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("unc/"))
        {
            return format!("//{}", &rest[4..]);
        }
        return rest.to_string();
    }
    normalized
}

fn has_windows_drive_prefix(slash_path: &str) -> bool {
    let bytes = slash_path.as_bytes();
    bytes.len() >= 2
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes.len() == 2 || bytes[2] == b'/')
}

fn normalize_segments_lower(path: &str, preserve_leading_parent: bool) -> String {
    let mut segments: Vec<String> = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                if !preserve_leading_parent || segments.last().is_some_and(|last| last != "..") {
                    segments.pop();
                } else {
                    segments.push("..".to_string());
                }
            }
            normal => segments.push(normal.to_ascii_lowercase()),
        }
    }
    segments.join("/")
}

/// Lexically normalize separators, repeated slashes, `.` (`CurDir`), and `..`
/// (`ParentDir`) into lowercase slash form after stripping Windows verbatim
/// (`\\?\`, `\\.\`) prefixes.
fn lexical_normalize_lower(raw: &str) -> String {
    let stripped = strip_windows_verbatim_prefix(raw.trim());
    let bytes = stripped.as_bytes();
    if has_windows_drive_prefix(&stripped) {
        let drive = char::from(bytes[0]).to_ascii_lowercase();
        let rest = if bytes.len() > 2 { &stripped[3..] } else { "" };
        return format!("{drive}:/{}", normalize_segments_lower(rest, false));
    }

    if stripped.starts_with('/') {
        return format!("/{}", normalize_segments_lower(&stripped, false));
    }

    normalize_segments_lower(&stripped, true)
}

fn has_path_prefix(path: &str, prefix: &str) -> bool {
    path == prefix
        || path
            .strip_prefix(prefix)
            .is_some_and(|rest| rest.starts_with('/'))
}

fn matches_blocked_system_prefix(normalized_lower: &str) -> bool {
    if BLOCKED_UNIX_PREFIXES
        .iter()
        .any(|prefix| has_path_prefix(normalized_lower, prefix))
    {
        return true;
    }

    let Some((drive, rest)) = normalized_lower.split_once(":/") else {
        return false;
    };
    if drive.len() != 1 || !drive.chars().all(|ch| ch.is_ascii_alphabetic()) {
        return false;
    }
    BLOCKED_WINDOWS_SUBDIRS
        .iter()
        .any(|subdir| has_path_prefix(rest, subdir))
}

/// Canonicalize `path` directly if it exists, or canonicalize its nearest
/// existing ancestor and re-append the non-existent tail components so write
/// targets beneath symlinked/junctioned directories still resolve cleanly.
fn canonicalize_with_existing_ancestor(path: &Path) -> Option<PathBuf> {
    if let Ok(canonical) = std::fs::canonicalize(path) {
        return Some(canonical);
    }

    let mut tail: Vec<OsString> = Vec::new();
    let mut cursor = path;
    loop {
        let file_name = cursor.file_name()?;
        tail.push(file_name.to_os_string());
        let parent = cursor.parent()?;
        if parent.as_os_str().is_empty() {
            let mut canonical = std::fs::canonicalize(Path::new(".")).ok()?;
            for component in tail.into_iter().rev() {
                canonical.push(component);
            }
            return Some(canonical);
        }
        if let Ok(mut canonical) = std::fs::canonicalize(parent) {
            for component in tail.into_iter().rev() {
                canonical.push(component);
            }
            return Some(canonical);
        }
        cursor = parent;
    }
}

pub fn is_blocked_system_path(path: &str) -> bool {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return false;
    }

    let normalized_lexical = lexical_normalize_lower(trimmed);
    if matches_blocked_system_prefix(&normalized_lexical) {
        return true;
    }

    let stripped = strip_windows_verbatim_prefix(trimmed);
    if cfg!(not(windows)) && has_windows_drive_prefix(&stripped) {
        return false;
    }

    let probe_path = Path::new(&stripped);
    if let Some(canonical) = canonicalize_with_existing_ancestor(probe_path) {
        let canonical_normalized = lexical_normalize_lower(&canonical.to_string_lossy());
        if matches_blocked_system_prefix(&canonical_normalized) {
            return true;
        }
    }

    false
}

pub fn path_contains_parent_traversal(path: &str) -> bool {
    Path::new(path)
        .components()
        .any(|component| matches!(component, Component::ParentDir))
        || path.split(['/', '\\']).any(|segment| segment == "..")
}

pub fn reject_unsafe_path_surface(path: &str) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".into());
    }
    if trimmed.contains('\0') {
        return Err("Path contains invalid characters".into());
    }
    if is_network_path(trimmed) {
        return Err("Network paths are not allowed".into());
    }
    if path_contains_parent_traversal(trimmed) {
        return Err("Parent directory traversal is not allowed".into());
    }
    if has_url_scheme(trimmed) {
        return Err("URL paths are not allowed".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_url_network_and_traversal_surfaces() {
        assert!(reject_unsafe_path_surface("file:///etc/passwd").is_err());
        assert!(reject_unsafe_path_surface("\\\\srv\\share\\x.json").is_err());
        assert!(reject_unsafe_path_surface("../secret.json").is_err());
    }

    #[test]
    fn allows_plain_and_drive_paths() {
        assert!(reject_unsafe_path_surface("theme.json").is_ok());
        assert!(reject_unsafe_path_surface("C:\\Users\\me\\theme.json").is_ok());
    }

    #[test]
    fn blocks_system_paths() {
        assert!(is_blocked_system_path("C:\\Windows\\system32\\config.json"));
        assert!(is_blocked_system_path("/etc/theme.json"));
        assert!(is_blocked_system_path("/proc/self/environ"));
        assert!(is_blocked_system_path("/dev/random"));
        assert!(is_blocked_system_path("/sys/kernel"));
        assert!(is_blocked_system_path("/root/.ssh/id_rsa"));
        assert!(!is_blocked_system_path("C:\\Users\\me\\theme.json"));
    }

    #[test]
    fn blocks_obfuscated_and_verbatim_system_paths() {
        assert!(is_blocked_system_path("C://Windows/System32/cmd.exe"));
        assert!(is_blocked_system_path("C:\\.\\Windows\\System32\\cmd.exe"));
        assert!(is_blocked_system_path(r"\\?\C:\Windows\System32\cmd.exe"));
        assert!(is_blocked_system_path(r"\\.\C:\Program Files\app\x.json"));
        assert!(is_blocked_system_path("C:\\Users\\me\\..\\..\\Windows\\win.ini"));
        assert!(is_blocked_system_path("C:\\Windows"));
        assert!(is_blocked_system_path("/./etc/passwd"));
        assert!(is_blocked_system_path("///etc//passwd"));
        assert!(is_blocked_system_path("/etc"));
        assert!(is_blocked_system_path("  /etc/passwd"));
    }

    #[test]
    fn does_not_block_similar_non_system_prefixes() {
        assert!(!is_blocked_system_path("C:\\WindowsBackup\\theme.json"));
        assert!(!is_blocked_system_path("/etcetera/theme.json"));
        assert!(!is_blocked_system_path("C:\\ProgramDataBackup\\a.png"));
    }

    #[test]
    fn canonicalize_with_existing_ancestor_resolves_nonexistent_child() {
        let dir = tempfile::tempdir().expect("temp dir");
        let missing = dir.path().join("nested").join("new-theme.json");
        let resolved =
            canonicalize_with_existing_ancestor(&missing).expect("ancestor should canonicalize");
        assert!(resolved.ends_with(Path::new("nested").join("new-theme.json")));
    }

    #[cfg(unix)]
    #[test]
    fn blocks_symlinked_ancestor_pointing_to_system_dir() {
        let dir = tempfile::tempdir().expect("temp dir");
        let link = dir.path().join("syslink");
        std::os::unix::fs::symlink("/etc", &link).expect("symlink to /etc");

        let existing_target = link.join("hosts");
        let nonexistent_target = link.join("new-theme.json");
        assert!(is_blocked_system_path(existing_target.to_str().unwrap()));
        assert!(is_blocked_system_path(nonexistent_target.to_str().unwrap()));
    }

    #[test]
    fn handles_multibyte_utf8_with_verbatim_prefix_without_panicking() {
        assert!(!is_blocked_system_path(r"\\?\a😀\theme.json"));
        assert!(!is_blocked_system_path(r"\\.\😀\theme.json"));
        assert!(is_blocked_system_path(r"\\?\C:\a😀\..\Windows\win.ini"));
        assert!(!is_blocked_system_path(r"\\?\UNC\server\share\theme.json"));
    }
}
