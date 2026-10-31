"""Reconcile repository defaults with saved records while retaining local edits."""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.database.store import ROOT, Store
from backend.schemas.entities import Component, Vehicle

PROJECT_ID = 'team-parts-2026-10-22'
STATE_KIND = 'project_sync'
MISSING = object()
REFERENCE_LISTS = {'component_ids', 'procurement_component_ids', 'hardware_component_ids', 'material_component_ids'}
SINGLE_ASSEMBLIES = {'motor', 'battery', 'drivetrain', 'chassis', 'inverter', 'tires',
                     'brakes', 'suspension', 'steering', 'throttle_control'}


def source_revision():
    paths = [*ROOT.glob('data/components/team*.json'), *ROOT.glob('data/vehicles/team*.json'),
             *ROOT.glob('scripts/load_*.py'), ROOT / 'backend/schemas/entities.py']
    digest = sha256()
    for path in sorted(paths):
        digest.update(path.relative_to(ROOT).as_posix().encode())
        # Git line-ending conversion must not count as a car change.
        digest.update(path.read_text(encoding='utf-8').replace('\r\n', '\n').encode())
    return digest.hexdigest()


def repository_snapshot():
    from scripts.load_team_project import load
    with TemporaryDirectory(prefix='ev-project-defaults-') as folder:
        defaults = Store(Path(folder) / 'defaults.sqlite')
        load(defaults)
        return {kind: {record['id']: record for record in defaults.list(kind)}
                for kind in ['components', 'vehicles']}


def _merge(current, previous, latest, categories, path=()):
    if previous is MISSING:
        return deepcopy(latest) if current is MISSING else current
    if current is MISSING:
        return MISSING  # An explicit local deletion stays deleted.
    if latest is MISSING:
        return MISSING if current == previous else current
    if current == previous:
        return deepcopy(latest)
    if previous == latest:
        return current
    if all(isinstance(value, dict) for value in (current, previous, latest)):
        merged = {}
        for key in dict.fromkeys([*current, *latest]):
            value = _merge(current.get(key, MISSING), previous.get(key, MISSING),
                           latest.get(key, MISSING), categories, (*path, key))
            if value is not MISSING:
                merged[key] = value
        return merged
    if (path and path[-1] in REFERENCE_LISTS
            and all(isinstance(value, list) and all(isinstance(key, str) for key in value)
                    for value in (current, previous, latest))):
        # Apply repository additions/removals alongside independently added parts.
        # A locally replaced motor/battery/etc. keeps that user's selection.
        removed_locally = set(previous) - set(current)
        blocked = {categories.get(key) for key in removed_locally} & SINGLE_ASSEMBLIES
        removed_in_repo = set(previous) - set(latest)
        result = [key for key in current if key not in removed_in_repo]
        result += [key for key in latest if key not in previous and key not in result
                   and categories.get(key) not in blocked]
        return result
    return current  # Conflicting measurements or choices retain the local value.


def sync_repository_defaults(store, revision, latest):
    """Commit changed defaults and their baseline together; never alter run snapshots."""
    with store.connect() as con:
        con.execute('BEGIN IMMEDIATE')
        row = con.execute('SELECT body FROM records WHERE kind=? AND id=?',
                          (STATE_KIND, PROJECT_ID)).fetchone()
        state = json.loads(row[0]) if row else None
        if state and state['revision'] == revision:
            return
        # On first adoption, the historical migrations have already run. Treat
        # existing differences from today's defaults as deliberate local edits.
        previous = state['snapshot'] if state else latest
        current = {kind: {key: json.loads(body) for key, body in con.execute(
            'SELECT id,body FROM records WHERE kind=?', (kind,))}
            for kind in ['components', 'vehicles']}
        categories = {key: part['category'] for source in [previous, latest, current]
                      for key, part in source['components'].items()}
        for kind, model in [('components', Component), ('vehicles', Vehicle)]:
            for key, repo_record in latest[kind].items():
                saved = current[kind].get(key, MISSING)
                # Never claim a record explicitly moved to another project.
                if (saved is not MISSING and saved.get('custom_parameters', {}).get('document_project')
                        not in (None, PROJECT_ID)):
                    continue
                merged = _merge(saved, previous[kind].get(key, MISSING), repo_record,
                                categories)
                if merged is MISSING or merged == saved:
                    continue
                validated = model.model_validate(merged).model_dump()
                con.execute('INSERT OR REPLACE INTO records VALUES(?,?,?)',
                            (kind, key, json.dumps(validated, allow_nan=False)))
        # Removed records stay available as historical designs/component options.
        con.execute('INSERT OR REPLACE INTO records VALUES(?,?,?)',
                    (STATE_KIND, PROJECT_ID, json.dumps(
                        {'id': PROJECT_ID, 'revision': revision, 'snapshot': latest}, allow_nan=False)))
