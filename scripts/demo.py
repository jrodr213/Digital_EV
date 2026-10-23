"""Run a real FASTSim demonstration and export its trace/report to data/."""
from backend.api.main import seed,execute,store,result_csv,report
from backend.database.store import ROOT
from backend.schemas.entities import RunRequest
import json

if __name__=='__main__':
    seed()
    r=execute(RunRequest(vehicle_id='demo-student-ev'))
    out=ROOT/'data/simulation_results'; out.mkdir(parents=True,exist_ok=True)
    (out/'demo-udds.csv').write_bytes(result_csv(r['id']).body)
    (out/'demo-report.md').write_bytes(report(r['id']).body)
    print(json.dumps({'id':r['id'],'FASTSim':r['summary'],'analytical':r['analytical']},indent=2))
