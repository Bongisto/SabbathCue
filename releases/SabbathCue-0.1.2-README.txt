SabbathCue 0.1.2 — Performance Update
=====================================

Build date: 2026-05-19
Previous public build: 0.1.1

This is an updated release with internal performance improvements.
User-facing workflow is unchanged (same UI and features).

What's improved in 0.1.2
------------------------
- Faster startup: broadcast settings and theme designer load on first use
- Smoother preview and live canvas rendering when content hasn't changed
- Less duplicate work when sending the same broadcast output
- Cleaner store loading (fixes a development build warning)

Installers (after build)
------------------------
- NSIS setup (recommended): src-tauri\target\release\bundle\nsis\SabbathCue_0.1.2_x64-setup.exe
- MSI: src-tauri\target\release\bundle\msi\SabbathCue_0.1.2_x64_en-US.msi
- Portable exe: src-tauri\target\release\SabbathCue.exe

Verify version: Windows Settings > Apps, or right-click the .exe > Properties > Details.
