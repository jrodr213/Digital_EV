"""Bring older team drafts forward, then follow repository car defaults."""
from importlib import import_module

from backend.database.store import Store
from backend.database.project_sync import (
    PROJECT_ID, STATE_KIND, repository_snapshot, source_revision, sync_repository_defaults,
)

# Historical upgrades are ordered because later assemblies depend on earlier ones.
UPGRADES = [
    ('sensor_layout_version', 1, 'scripts.load_sensor_project'),
    ('motor_selection_version', 1, 'scripts.load_motor_project'),
    ('architecture_update_version', 2, 'scripts.load_architecture_project'),
    ('battery_selection_version', 1, 'scripts.load_battery_project'),
    ('drive_hardware_version', 1, 'scripts.load_drive_hardware'),
    ('direct_drive_version', 1, 'scripts.load_direct_drive'),
]


def apply_project_updates(store: Store):
    try:
        vehicle = store.get('vehicles', 'team-ev-belt')
    except KeyError:
        return
    if vehicle.get('custom_parameters', {}).get('document_project') != PROJECT_ID:
        return
    revision = source_revision()
    try:
        state = store.get(STATE_KIND, PROJECT_ID)
        if state['revision'] == revision:
            return
    except KeyError:
        state = None
    latest = repository_snapshot()
    if state is None:
        for field, version, module in UPGRADES:
            current = store.get('vehicles', vehicle['id'])
            if current['custom_parameters'].get(field, 0) < version:
                import_module(module).load(store)
    sync_repository_defaults(store, revision, latest)
