"""Exercise the frozen server, actual FASTSim, authentication, data persistence and shutdown."""
import argparse
import json
import os
from pathlib import Path
from queue import Queue, Empty
import secrets
import subprocess
import sys
from tempfile import TemporaryDirectory
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def request(url, token=None, data=None):
    headers = {'X-EV-Twin-Token': token} if token else {}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    with urlopen(Request(url, body, headers), timeout=30) as response:
        raw = response.read()
        return json.loads(raw) if 'application/json' in response.headers.get('Content-Type', '') else raw


def run_server(command, database, check):
    token = secrets.token_hex(32)
    env = {**os.environ, 'EV_DB': str(database), 'EV_DESKTOP_TOKEN': token, 'PYTHONPATH': str(ROOT)}
    with database.with_suffix('.log').open('a', encoding='utf-8') as log:
        process = subprocess.Popen(command, cwd=database.parent, env=env, stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=log, text=True)
        lines = Queue()
        def read_output():
            for line in process.stdout:
                lines.put(line)
        threading.Thread(target=read_output, daemon=True).start()
        try:
            deadline = time.monotonic() + 90
            while time.monotonic() < deadline:
                try:
                    line = lines.get(timeout=.25)
                except Empty:
                    if process.poll() is not None:
                        raise RuntimeError(database.with_suffix('.log').read_text())
                    continue
                if line.startswith('EV_TWIN_READY '):
                    origin = json.loads(line.split(' ', 1)[1])['url']
                    break
            else:
                raise TimeoutError('Frozen backend did not start.')
            check(origin, token)
        finally:
            process.stdin.close()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                raise AssertionError('Engine did not exit when its parent pipe closed.')
        assert process.returncode == 0, database.with_suffix('.log').read_text()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='store_true', help='Exercise source entrypoint instead of frozen executable.')
    parser.add_argument('--executable', type=Path)
    args = parser.parse_args()
    executable = args.executable or ROOT / 'desktop/backend-dist/ev-twin-backend' / ('ev-twin-backend.exe' if os.name == 'nt' else 'ev-twin-backend')
    command = [sys.executable, str(ROOT / 'desktop/backend_entry.py')] if args.source else [str(executable)]
    with TemporaryDirectory(prefix='ev-twin-desktop-smoke-') as folder:
        database = Path(folder) / 'persistent/ev.sqlite'
        database.parent.mkdir()
        saved = {}
        def first(origin, token):
            try:
                request(origin + '/api/health')
                raise AssertionError('Unauthenticated API request was accepted.')
            except HTTPError as error:
                assert error.code == 403
            health = request(origin + '/api/health', token)
            assert health['fastsim'] == '3.1.0' and health['preview_mode'] == 'desktop'
            assert b'<div id="root"' in request(origin + '/', token)
            parts = request(origin + '/api/components', token)
            assert all(any(part['id'] == key for part in parts) for key in ['team-motor-my1020-single-48v', 'team-drive-option-belt-comet30', 'team-drive-option-chain-sprocket'])
            cars = request(origin + '/api/vehicles', token)
            assert any(car['id'] == 'team-ev-single-motor' for car in cars)
            result = request(origin + '/api/runs', token, {'vehicle_id': 'team-ev-single-motor', 'demo_mode': True})
            assert result['engine'] == 'FASTSim' and result['samples']
            saved['result'] = result['id']
            assert b'time_s,' in request(origin + f'/api/results/{result["id"]}/csv', token)
        run_server(command, database, first)
        assert database.exists()
        def second(origin, token):
            history = request(origin + '/api/results', token)
            assert any(result['id'] == saved['result'] for result in history)
        run_server(command, database, second)
    print('PASS: standalone engine, built frontend, private session, current cars/parts, real FASTSim run/export, persistence and parent-owned shutdown.')


if __name__ == '__main__':
    main()
