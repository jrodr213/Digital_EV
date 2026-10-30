"""Load missing records, then apply the sensor, motor and latest concept updates."""
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
    from scripts.load_motor_project import load as load_motors
    motor_counts = load_motors(store)
    counts['components'] += motor_counts['components']
    from scripts.load_architecture_project import load as load_architecture
    architecture_counts = load_architecture(store)
    counts['components'] += architecture_counts['components']
    from scripts.load_battery_project import load as load_battery
    battery_counts = load_battery(store)
    counts['components'] += battery_counts['components']
    from scripts.load_drive_hardware import load as load_hardware
    hardware_counts = load_hardware(store)
    counts['components'] += hardware_counts['components']
    return counts


if __name__=='__main__': print(json.dumps(load()))
