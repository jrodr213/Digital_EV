# Downloadable desktop app

EV Twin packages the React interface in an Electron window and includes a native Python/FASTSim server. Users do not need to install Python or Node.js. The built interface, component/vehicle defaults, simulation engine and standard drive cycles work offline. Product links open the system browser.

## Install and run

| Computer | Download | Installation |
| --- | --- | --- |
| Windows x64 | `EV-Twin-1.0.0-windows-x64-Setup.exe` | Run the installer. Choose the installation directory and launch EV Twin. |
| macOS Apple Silicon | `EV-Twin-1.0.0-mac-arm64.dmg` | Open the disk image and drag EV Twin to Applications. A ZIP is also produced. |
| macOS Intel | `EV-Twin-1.0.0-mac-x64.dmg` | Open the disk image and drag EV Twin to Applications. A ZIP is also produced. |
| Linux x64 | `EV-Twin-1.0.0-linux-x86_64.AppImage` | Mark the AppImage executable and open it. `EV-Twin-1.0.0-linux-amd64.deb` is also produced for Debian/Ubuntu systems. |

These are the configured artifact names. A platform download is available only after its native build and smoke tests complete. CI runs on Windows Server 2022, macOS 15 (both architectures) and Ubuntu 22.04. Linux systems need the usual graphical desktop libraries and FUSE 2 for AppImage mounting. Linux ARM and Windows ARM native packages are not configured.

The initial builds are unsigned; macOS notarization is disabled until a maintainer configures signing credentials. macOS and Windows can show publisher warnings. For an app obtained from a trusted source, use the OS's per-app approval flow; do not disable global protections. Public distribution should use a Developer ID certificate and Apple notarization for Mac, and a trusted Windows code-signing certificate. No signing keys are stored in the repository.

## Saved data

The app uses a separate writable `ev.sqlite` in Electron's user-data directory:

- Windows: `%APPDATA%\EV Twin\ev.sqlite`.
- macOS: `~/Library/Application Support/EV Twin/ev.sqlite`.
- Linux: `$XDG_CONFIG_HOME/EV Twin/ev.sqlite`, normally `~/.config/EV Twin/ev.sqlite`.

Use **File → Open data folder** for the exact directory and **File → Open log file** for startup diagnostics. Database writes never target the installation folder. Updates keep this folder, and Windows uninstallers preserve it. Each app version reconciles changed bundled defaults with saved edits through the existing repository-default synchronization rules; previous simulation snapshots are preserved.

Installers contain the component and vehicle JSON defaults, including the selected one- and two-motor cars. They exclude `data/ev.sqlite`, simulation exports, local logs, credentials, developer dependencies and test databases. To move existing workspace data into the desktop app:

1. Quit the desktop app and stop the source preview.
2. Back up the source `data/ev.sqlite` and any existing desktop `ev.sqlite`.
3. Copy the source database into the desktop user-data folder as `ev.sqlite`.
4. Start EV Twin. Its normal migrations/default synchronization preserve saved designs and results.

Copying the database between OSes works with SQLite; preserve backups before replacing a destination file. `EV_DESKTOP_DATA_DIR` can select another user-data directory for portable use or testing. App smoke tests always use temporary directories.

## Build locally

Build on the OS and CPU architecture you want to distribute. PyInstaller freezes native Python extensions, including FASTSim, so a Mac backend is not a Windows or Linux executable. Install Python 3.12 and Node.js 22.16+ with npm for **building**:

```sh
python -m venv .venv
# Activate .venv using the command appropriate for your shell, then:
python scripts/build_desktop.py
```

The build script installs the Python requirements plus pinned PyInstaller, installs both npm projects from their lockfiles, builds the frontend, freezes the backend, runs a real FASTSim smoke test and creates native installers in `desktop/release/`. Use `--skip-install` after dependencies are installed, or `--dir` for an unpacked app. Builds require internet to download dependencies and the Electron runtime; installed apps do not.

```sh
python scripts/build_desktop.py --dir --skip-install
node desktop/smoke_app.mjs
npm run dist --prefix desktop
python desktop/checksums.py
```

On headless Linux run the app test under `xvfb-run --auto-servernum`. The frozen-engine check exercises authentication, the built frontend, the latest cars/parts, an actual FASTSim run, CSV export, database persistence after restart and engine exit after its parent's pipe closes. The packaged-app check opens the native executable, checks sandbox isolation, WebGL, conditional part prices and actual simulation persistence. SHA-256 manifests accompany the downloads.

On Linux and Intel Mac CI, the app test explicitly uses Chromium SwiftShader to exercise WebGL without a physical GPU. Apple Silicon CI uses its normal graphics path because Chromium disables SwiftShader WebGL on ARM Macs. These flags apply only to the test launcher; installed apps use their normal graphics settings.

## Build all platforms and prepare downloads

The **Desktop downloads** GitHub Actions workflow has four native jobs: Windows x64, Apple Silicon Mac, Intel Mac and Linux x64. Run it manually from Actions to obtain installer artifacts; choose `all` or a single target when retrying a platform. Pull requests touching app inputs run the full set of checks. Artifacts are retained for 30 days.

For a release, update `desktop/package.json` and its lockfile version, then push a matching `desktop-v<version>` tag. Only after **all** native builds and smoke tests pass does the workflow create a **draft** GitHub Release with the installers and checksums. Review its files and publisher/signing status before making the draft public. Artifact upload is not an auto-update mechanism; no background updater is included.

## Desktop process boundary

The app binds its embedded API to `127.0.0.1` on an OS-assigned port and supplies a fresh per-launch token from the Electron main process. That token is required on requests to the desktop server; other local pages do not receive it. The renderer runs with sandboxing, context isolation and Node integration disabled. New external HTTP(S) links open the system browser; arbitrary URL schemes, webviews and renderer permissions are denied. The parent owns the engine through a pipe, and the engine exits if the parent quits or crashes.

The existing source preview still uses ports 8000/8001 and its workspace database. Its normal browser access and development workflow are retained.
