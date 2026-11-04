"""Frozen local server owned by one desktop process; never uses the repo database."""
import json
import os
from pathlib import Path
import socket
import sys
import threading


def main():
    database = os.environ.get('EV_DB')
    token = os.environ.get('EV_DESKTOP_TOKEN', '')
    if not database or not Path(database).is_absolute() or len(token) < 32:
        raise RuntimeError('Desktop startup requires an absolute EV_DB path and a private session token.')
    os.environ['EV_PREVIEW_MODE'] = 'desktop'
    # Import after the desktop has selected its writable, persistent database.
    from backend.api.main import app
    import uvicorn

    class DesktopServer(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets=sockets)
            if not self.should_exit:
                print('EV_TWIN_READY ' + json.dumps({'url': address}), flush=True)

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(('127.0.0.1', 0))
        address = f'http://127.0.0.1:{listener.getsockname()[1]}'
        server = DesktopServer(uvicorn.Config(app, host='127.0.0.1', port=0,
                              loop='asyncio', http='h11', ws='none',
                              access_log=False, timeout_graceful_shutdown=10))

        def watch_parent():
            # The parent's pipe closes on quit or crash, including on Windows.
            while sys.stdin.buffer.read(1):
                pass
            server.should_exit = True

        threading.Thread(target=watch_parent, daemon=True).start()
        server.run(sockets=[listener])


if __name__ == '__main__':
    main()
