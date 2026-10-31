"""SQLite document records: JSON preserves arbitrary component specifications and units."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]


class Store:
    def __init__(self, path=None):
        self.path = str(path or os.environ.get('EV_DB', ROOT / 'data' / 'ev.sqlite'))
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as con:
            con.execute('CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, body TEXT NOT NULL, PRIMARY KEY(kind,id))')

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=30)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def put(self, kind, body):
        body = dict(body)
        body['id'] = body.get('id') or str(uuid4())
        encoded = json.dumps(body, allow_nan=False)
        with self.connect() as con:
            con.execute('INSERT OR REPLACE INTO records VALUES(?,?,?)', (kind, body['id'], encoded))
        return body

    def get(self, kind, id):
        with self.connect() as con:
            row = con.execute('SELECT body FROM records WHERE kind=? AND id=?', (kind, id)).fetchone()
        if not row:
            raise KeyError(f'{kind} {id} does not exist')
        return json.loads(row[0])

    def list(self, kind):
        with self.connect() as con:
            return [json.loads(r[0]) for r in con.execute('SELECT body FROM records WHERE kind=? ORDER BY rowid', (kind,))]

    def delete(self, kind, id):
        with self.connect() as con:
            con.execute('DELETE FROM records WHERE kind=? AND id=?', (kind, id))
