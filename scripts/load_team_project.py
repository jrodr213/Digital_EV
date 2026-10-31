"""Load repository team datasets, then apply the ordered car updates."""
import json
from backend.database.store import Store, ROOT
from backend.schemas.entities import Component, Vehicle


def load(store=None):
    store=store or Store()
    records={kind:[model.model_validate(record).model_dump()
                   for path in sorted((ROOT/'data'/kind).glob('team*.json'))
                   for record in json.loads(path.read_text(encoding='utf-8'))]
             for kind,model in [('components',Component),('vehicles',Vehicle)]}
    for kind,items in records.items():
        if len({item['id'] for item in items}) != len(items):
            raise ValueError(f'Duplicate IDs in repository team {kind} datasets.')
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
    from scripts.load_direct_drive import load as load_direct_drive
    direct_counts = load_direct_drive(store)
    counts['components'] += direct_counts['components']
    return counts


if __name__=='__main__': print(json.dumps(load()))
