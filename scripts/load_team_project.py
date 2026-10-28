"""Load missing team records, then apply the additive sensor-layout migration."""
import json
from backend.database.store import Store, ROOT
from backend.schemas.entities import Component, Vehicle


def load(store=None):
    store=store or Store()
    records={
        'components':[Component.model_validate(p).model_dump() for p in json.loads((ROOT/'data/components/team-parts.json').read_text(encoding='utf-8'))],
        'vehicles':[Vehicle.model_validate(v).model_dump() for v in json.loads((ROOT/'data/vehicles/team-drafts.json').read_text(encoding='utf-8'))],
    }
    counts={}
    for kind,items in records.items():
        existing={r['id'] for r in store.list(kind)}
        new=[r for r in items if r['id'] not in existing]
        for r in new: store.put(kind,r)
        counts[kind]=len(new)
    from scripts.load_sensor_project import load as load_sensors
    sensor_counts = load_sensors(store)
    counts['components'] += sensor_counts['components']
    return counts


if __name__=='__main__': print(json.dumps(load()))
