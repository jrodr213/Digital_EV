import csv
import io
import json
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from backend.database.store import Store, ROOT
from backend.schemas.entities import Component, Vehicle, DriveCycle, RunRequest, SweepRequest
from backend.components.catalog import FIELDS, REQUIRED
from backend.validation.assembly import assemble
from backend.simulation.fastsim_adapter import FastSimEngine
from backend.simulation.demo import prepare_demo, DEMO_NOTICE
from backend.simulation.demo_review import with_demo_review, review_markdown

store=Store()


def seed():
    if not store.list('components') and not store.list('vehicles'):
        for c in json.loads((ROOT/'data/components/demo.json').read_text()): store.put('components',c)
        store.put('vehicles',json.loads((ROOT/'data/vehicles/demo.json').read_text()))


@asynccontextmanager
async def lifespan(app):
    seed()
    yield


app=FastAPI(title='EV / Twin Engineering API',lifespan=lifespan)


@app.exception_handler(KeyError)
async def missing(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=404,content={'detail':str(exc)})


@app.get('/api/health')
def health():
    import importlib.metadata
    return {'status':'ok','fastsim':importlib.metadata.version('fastsim')}


@app.get('/api/catalog')
def catalog(): return {'fields':FIELDS,'required':REQUIRED}


@app.get('/api/components')
def components(): return store.list('components')


@app.post('/api/components')
def save_component(c:Component): return store.put('components',c.model_dump())


@app.delete('/api/components/{id}')
def delete_component(id:str):
    if any(id in v['component_ids'] for v in store.list('vehicles')): raise HTTPException(409,'Component is used by a saved vehicle.')
    store.delete('components',id)
    return {'deleted':id}


@app.post('/api/components/import')
async def import_components(file:UploadFile):
    raw=await file.read(2_000_001)
    if len(raw)>2_000_000: raise HTTPException(413,'Maximum import size is 2 MB.')
    try:
        text=raw.decode('utf-8-sig')
        if file.filename.lower().endswith('.csv'):
            data=list(csv.DictReader(io.StringIO(text)))
            for row in data:
                for key in ['specs','units','custom_parameters']:
                    if key in row: row[key]=json.loads(row[key] or '{}')
                for key in ['price','mass_kg']:
                    if row.get(key)=='': row[key]=None
        else: data=json.loads(text)
        if not isinstance(data,list) or len(data)>1000: raise ValueError('Expected an array of at most 1000 components.')
        validated=[Component.model_validate(c).model_dump() for c in data]
    except (ValueError,UnicodeError) as exc: raise HTTPException(422,str(exc))
    # Validate the entire import before writing anything. Duplicate IDs are rejected.
    ids=[c['id'] for c in validated if c['id']]
    if len(ids)!=len(set(ids)): raise HTTPException(422,'Duplicate IDs in import.')
    return [store.put('components',c) for c in validated]


def resolve(v):
    a=assemble(v,[store.get('components',id) for id in v['component_ids']])
    a['auxiliary_w']=v['auxiliary_w']
    return a


@app.get('/api/vehicles')
def vehicles(): return store.list('vehicles')


@app.post('/api/vehicles/validate')
def validate(v:Vehicle): return resolve(v.model_dump())


@app.post('/api/runs/preview')
def preview(req:RunRequest):
    vehicle=store.get('vehicles',req.vehicle_id)
    if req.demo_mode:
        _, a=prepare_demo(vehicle,[store.get('components',id) for id in vehicle['component_ids']])
        return a
    return resolve(vehicle)


@app.post('/api/vehicles')
def save_vehicle(v:Vehicle):
    for id in v.component_ids: store.get('components',id)
    return store.put('vehicles',v.model_dump())


@app.delete('/api/vehicles/{id}')
def delete_vehicle(id:str):
    store.delete('vehicles',id)
    return {'deleted':id}


@app.get('/api/cycles')
def cycles(): return [{'id':'demo-cart','name':'Low-speed demo / 0–10 mph / 120 s'}]+[{'id':c,'name':c.upper()+' / official FASTSim'} for c in ['udds','hwfet','us06']]+[{'id':c['id'],'name':c['name']} for c in store.list('cycles')]


@app.post('/api/cycles')
def save_cycle(c:DriveCycle): return store.put('cycles',c.model_dump())


@app.post('/api/cycles/import')
async def import_cycle(file:UploadFile):
    raw=await file.read(2_000_001)
    if len(raw)>2_000_000: raise HTTPException(413,'Maximum 2 MB.')
    try:
        rows=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
        c=DriveCycle(name=file.filename,time_s=[float(r['time_s']) for r in rows],speed_mps=[float(r['speed_mps']) for r in rows],grade=[float(r['grade']) for r in rows])
    except (ValueError,KeyError,UnicodeError) as exc: raise HTTPException(422,str(exc))
    return store.put('cycles',c.model_dump())


def execute(req, override=None):
    vehicle=store.get('vehicles',req.vehicle_id)
    if req.demo_mode:
        vehicle,a=prepare_demo(vehicle,[store.get('components',id) for id in vehicle['component_ids']])
    else:
        a=resolve(vehicle)
    if override:
        from copy import deepcopy
        parts=deepcopy(a['components']); key,value=override
        if key=='payload_kg': vehicle={**vehicle,'payload_kg':value}
        else:
            category={'gear_ratio':'drivetrain','wheel_diameter_m':'drivetrain','capacity_ah':'battery','peak_power_kw':'motor'}[key]
            for c in parts:
                if c['category']==category: c['specs'][key]=value
        a=assemble(vehicle,parts); a['auxiliary_w']=vehicle['auxiliary_w']
    if a['errors']: raise HTTPException(422,{'errors':a['errors'],'warnings':a['warnings']})
    custom=None if req.cycle in ['udds','hwfet','us06','demo-cart'] else store.get('cycles',req.cycle)
    try: result=FastSimEngine().run(a,req,custom)
    except (ValueError,RuntimeError,TypeError,OSError) as exc: raise HTTPException(422,f'FASTSim failed: {exc}')
    if req.demo_mode:
        result['demo_assumptions']=a['demo_assumptions']
        result['assumptions']=[DEMO_NOTICE]+result['assumptions']
    result['vehicle_snapshot']=vehicle
    result['name']=vehicle['name']+(' / DEMO ESTIMATE' if req.demo_mode else '')+(f' / {override[0]}={override[1]}' if override else '')
    from datetime import datetime, timezone
    result['created_at']=datetime.now(timezone.utc).isoformat()
    return store.put('results',with_demo_review(result))


@app.post('/api/runs')
def run(req:RunRequest): return execute(req)


@app.post('/api/experiments')
def experiment(req:SweepRequest):
    import math
    if any(not math.isfinite(v) or v<0 for v in req.values): raise HTTPException(422,'Sweep values must be finite and nonnegative.')
    if req.parameter!='none' and not req.values: raise HTTPException(422,'Supply sweep values.')
    if len(req.vehicle_ids)*max(len(req.values),1)>24: raise HTTPException(422,'Maximum 24 simulations per experiment.')
    results=[]
    for id in req.vehicle_ids:
        for value in (req.values if req.parameter!='none' else [None]):
            result=execute(RunRequest(vehicle_id=id,cycle=req.cycle),(req.parameter,value) if value is not None else None)
            results.append(result)
    def score(r):
        val={**r['summary'],**r['analytical']}.get(req.metric)
        return (val is None, -val if val is not None and req.metric in ['range_miles','top_speed_mph'] else val or 0)
    return sorted(results,key=score)


@app.get('/api/results')
def results(): return [{k:r[k] for k in ['id','name','summary','analytical','created_at','request']} for r in store.list('results')]


@app.get('/api/results/{id}')
def result(id:str): return with_demo_review(store.get('results',id))


@app.get('/api/results/{id}/csv')
def result_csv(id:str):
    r=store.get('results',id); out=io.StringIO(); writer=csv.DictWriter(out,fieldnames=list(r['samples'][0])); writer.writeheader(); writer.writerows(r['samples'])
    return Response(out.getvalue(),media_type='text/csv',headers={'Content-Disposition':f'attachment; filename="{id}.csv"'})


@app.get('/api/results/{id}/report')
def report(id:str):
    r=with_demo_review(store.get('results',id))
    text=f"# EV engineering test report\n\n{r['name']}\n\nEngine: {r['engine']} {r['engine_version']}\n\n"
    if r.get('demo_review'):
        text+=review_markdown(r['demo_review'])
    for key in ['summary','analytical','warnings','assumptions','request','vehicle_snapshot','assembly','mapped_vehicle']:
        text+=f'## {key}\n\n```json\n{json.dumps(r[key],indent=2)}\n```\n\n'
    if r.get('demo_assumptions') is not None:
        text+=f"## demo_assumptions\n\n```json\n{json.dumps(r['demo_assumptions'],indent=2)}\n```\n\n"
    return Response(text,media_type='text/markdown',headers={'Content-Disposition':f'attachment; filename="{id}-report.md"'})


dist=ROOT/'frontend/dist'
if dist.exists():
    app.mount('/assets',StaticFiles(directory=dist/'assets'),name='assets')
    @app.get('/{path:path}')
    def spa(path:str):
        if path.startswith('api/'): raise HTTPException(404,'Unknown API endpoint')
        return FileResponse(dist/'index.html')
