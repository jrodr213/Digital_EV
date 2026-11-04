# PyInstaller builds one native backend per OS/CPU. Never bundle workspace databases.
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, copy_metadata

root = Path(SPECPATH).parent
data = []
for folder, pattern in [('data/components', '*.json'), ('data/vehicles', '*.json'),
                        ('data/drive_cycles', '*.csv'), ('scripts', 'load_*.py')]:
    data += [(str(p), folder) for p in sorted((root / folder).glob(pattern))]
data += [(str(root / 'frontend/dist'), 'frontend/dist'),
         (str(root / 'backend/schemas/entities.py'), 'backend/schemas'),
         (str(root / 'LICENSE'), '.')]
data += collect_data_files('fastsim', excludes=['tests/**'])
data += copy_metadata('fastsim')
hidden = ['uvicorn.logging', 'uvicorn.loops.asyncio', 'uvicorn.protocols.http.h11_impl',
          'uvicorn.lifespan.on', 'multipart', 'python_multipart', 'msgpack', 'yaml']
hidden += ['scripts.' + p.stem for p in (root / 'scripts').glob('load_*.py')]

a = Analysis([str(root / 'desktop/backend_entry.py')], pathex=[str(root)],
             binaries=collect_dynamic_libs('fastsim'), datas=data, hiddenimports=hidden,
             excludes=['pytest', 'IPython', 'jupyter', 'matplotlib', 'tkinter'],
             noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='ev-twin-backend',
          debug=False, bootloader_ignore_signals=False, strip=False, upx=False, console=True)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='ev-twin-backend')
