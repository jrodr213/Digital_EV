from fastapi.testclient import TestClient

import backend.api.main as main
from backend.database.store import Store


def test_desktop_session_protects_reads_and_writes_without_affecting_browser_preview(tmp_path, monkeypatch):
    store = Store(tmp_path / 'desktop.sqlite')
    monkeypatch.setattr(main, 'store', store)
    monkeypatch.setenv('EV_DESKTOP_TOKEN', 'test-session-token-for-desktop-runtime')
    with TestClient(main.app) as client:
        assert client.get('/api/health').status_code == 403
        assert client.post('/api/components', json={'name': 'Untrusted', 'category': 'motor'}).status_code == 403
        assert client.get('/api/health', headers={'X-EV-Twin-Token': 'wrong'}).status_code == 403
        headers = {'X-EV-Twin-Token': 'test-session-token-for-desktop-runtime'}
        response = client.get('/api/health', headers=headers)
        assert response.status_code == 200
        assert "frame-ancestors 'none'" in response.headers['Content-Security-Policy']
        assert not any(part['name'] == 'Untrusted' for part in store.list('components'))
        monkeypatch.delenv('EV_DESKTOP_TOKEN')
        assert client.get('/api/health').status_code == 200
