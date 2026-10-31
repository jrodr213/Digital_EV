from fastapi.testclient import TestClient

from backend.api.main import app
from backend.database.store import ROOT


def test_preview_identity_and_html_are_not_cached(monkeypatch):
    monkeypatch.setenv('EV_PREVIEW_MODE', 'live')
    with TestClient(app) as client:
        health = client.get('/api/health')
        assert health.json()['preview_mode'] == 'live'
        assert health.json()['workspace'] == str(ROOT)
        assert health.headers['cache-control'] == 'no-store'
        # The built frontend also disables caching when served directly.
        if (ROOT / 'frontend/dist/index.html').exists():
            page = client.get('/')
            assert page.status_code == 200
            assert page.headers['cache-control'] == 'no-store'
