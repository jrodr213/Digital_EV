"""Add the separate single-motor car when adopting repository sync for the first time."""
import json

from backend.database.store import ROOT
from backend.schemas.entities import Component, Vehicle


def load(store):
    for kind, model in [('components', Component), ('vehicles', Vehicle)]:
        existing = {record['id'] for record in store.list(kind)}
        records = json.loads((ROOT / 'data' / kind / 'team-single-motor.json').read_text(encoding='utf-8'))
        for record in records:
            if record['id'] not in existing:
                store.put(kind, model.model_validate(record).model_dump())
