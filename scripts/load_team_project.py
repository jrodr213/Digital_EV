"""Load bundled team drafts without modifying existing components or designs."""
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
    return counts


if __name__=='__main__': print(json.dumps(load()))
