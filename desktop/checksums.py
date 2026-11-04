"""Write platform-specific SHA-256 manifests for generated download artifacts."""
from hashlib import sha256
from pathlib import Path
import platform

root = Path(__file__).resolve().parent / 'release'
system = {'Darwin': 'mac', 'Windows': 'windows', 'Linux': 'linux'}[platform.system()]
arch = 'arm64' if platform.machine().lower() in ['arm64', 'aarch64'] else 'x64'
artifacts = sorted(p for p in root.glob('EV-Twin-*')
                   if p.is_file() and p.suffix.lower() in ['.exe', '.dmg', '.zip', '.appimage', '.deb'])
if not artifacts:
    raise SystemExit('No desktop installers found.')
lines = []
for artifact in artifacts:
    digest = sha256()
    with artifact.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    lines.append(f'{digest.hexdigest()}  {artifact.name}')
manifest = root / f'SHA256SUMS-{system}-{arch}.txt'
manifest.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(manifest.read_text())
