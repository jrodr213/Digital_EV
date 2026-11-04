"""Build a self-contained desktop app on the target OS/CPU with Python 3.12 + Node 22+."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shutil
import struct
import subprocess
import sys
import zlib

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = ROOT / 'desktop'


def run(command, *, cwd=ROOT, env=None):
    print('+ ' + ' '.join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), cwd=cwd, env=env, check=True)


def make_icon():
    """Rasterize the app's simple vector mark using only the standard library."""
    size = 1024
    bolt = [(580, 150), (280, 560), (485, 560), (440, 875), (760, 430), (550, 430)]

    def inside(x, y):
        result = False
        for (ax, ay), (bx, by) in zip(bolt, bolt[1:] + bolt[:1]):
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                result = not result
        return result

    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            dx, dy = max(130-x, 0, x-893), max(130-y, 0, y-893)
            if dx*dx + dy*dy > 130*130:
                pixel = (0, 0, 0, 0)
            else:
                pixel = (224, 185, 116, 255) if inside(x, y) else (25, 59, 65, 255)
            row.extend(pixel)
        rows.append(row)

    def chunk(kind, value):
        return struct.pack('!I', len(value)) + kind + value + struct.pack('!I', zlib.crc32(kind+value))

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
    (DESKTOP / 'build-resources/icon.png').write_bytes(png)


def notices():
    lines = ['EV Twin — Python dependency notices',
             'The app source is Apache-2.0; see the accompanying LICENSE.',
             'Electron and Chromium notices are included separately by the desktop packager.', '']
    excluded = {'pytest', 'pyinstaller', 'pyinstaller-hooks-contrib', 'altgraph', 'macholib',
                'setuptools', 'pip', 'wheel', 'iniconfig', 'pluggy', 'pygments'}
    for dist in sorted(importlib.metadata.distributions(), key=lambda item: item.metadata['Name'].lower()):
        name = dist.metadata['Name']
        if name.lower() in excluded:
            continue
        lines += ['=' * 72, f'{name} {dist.version}',
                  dist.metadata.get('Home-page', ''),
                  dist.metadata.get('License-Expression') or dist.metadata.get('License', ''), '']
        for file in dist.files or []:
            if '.dist-info/' in str(file) and any(word in file.name.lower() for word in ['license', 'copying', 'notice']):
                path = Path(dist.locate_file(file))
                if path.is_file():
                    lines += [str(file), path.read_text(encoding='utf-8', errors='replace'), '']
    lock = json.loads((ROOT / 'frontend/package-lock.json').read_text())
    for directory, package in sorted(lock['packages'].items()):
        if not directory or package.get('dev'):
            continue
        folder = ROOT / 'frontend' / directory
        metadata_path = folder / 'package.json'
        if not metadata_path.exists():
            continue
        metadata = json.loads(metadata_path.read_text())
        lines += ['=' * 72, f'{metadata["name"]} {metadata["version"]} (frontend)',
                  str(metadata.get('license', '')), '']
        for file in sorted(folder.iterdir()):
            if file.is_file() and any(word in file.name.lower() for word in ['license', 'copying', 'notice']):
                lines += [file.name, file.read_text(encoding='utf-8', errors='replace'), '']
    (DESKTOP / 'build/THIRD-PARTY-NOTICES.txt').write_text('\n'.join(lines), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dir', action='store_true', help='Build an unpacked application for native smoke tests.')
    parser.add_argument('--skip-install', action='store_true', help='Use dependencies already installed in this Python environment and both npm projects.')
    args = parser.parse_args()
    if sys.version_info[:2] != (3, 12):
        parser.error('Use Python 3.12 to match the tested FASTSim runtime.')
    if platform.system() not in ['Windows', 'Darwin', 'Linux']:
        parser.error('Build on Windows, macOS or Linux.')
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        parser.error('Node.js 22.16+ with npm must be on PATH.')
    env = {**os.environ,
           'PYINSTALLER_CONFIG_DIR': str(DESKTOP / 'build/pyinstaller-cache'),
           'ELECTRON_CACHE': str(DESKTOP / 'build/electron-cache'),
           'ELECTRON_BUILDER_CACHE': str(DESKTOP / 'build/builder-cache')}
    (DESKTOP / 'build').mkdir(parents=True, exist_ok=True)
    if not args.skip_install:
        run([sys.executable, '-m', 'pip', 'install', '-r', 'backend/requirements-lock.txt',
             '-r', 'desktop/requirements-build.txt'], env=env)
        run([npm, 'ci'], cwd=ROOT / 'frontend', env=env)
        run([npm, 'ci'], cwd=DESKTOP, env=env)
    run([npm, 'run', 'build'], cwd=ROOT / 'frontend', env=env)
    make_icon()
    notices()
    run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
         '--distpath', DESKTOP / 'backend-dist', '--workpath', DESKTOP / 'build/pyinstaller',
         DESKTOP / 'backend.spec'], env=env)
    run([sys.executable, DESKTOP / 'smoke_backend.py'], env=env)
    run([npm, 'run', 'pack' if args.dir else 'dist'], cwd=DESKTOP, env=env)
    print(f'\nDesktop output: {DESKTOP / "release"}')


if __name__ == '__main__':
    main()
