import {ArrowUpRight} from 'lucide-react';
import type {Result} from '../types';
import {fmt} from '../api';
import {Blank,Panel} from '../components/ui';

export function History({runs,open,onNew}:{runs:Result[];open:(id:string)=>void;onNew?:()=>void}){
 return <Panel>{runs.length?<div className="table-scroll"><table><thead><tr><th>Vehicle / test</th><th>Cycle</th><th>Energy</th><th>Projected range</th><th>Recorded</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{runs.map(run=><tr key={run.id}><td className="table-primary">{run.vehicle_snapshot?.name??run.name}<small>{run.request.test} {run.request.demo_mode?'· Demo estimate':'· Saved simulation'}</small></td><td><span className="tag">{String(run.request.cycle).toUpperCase()}</span></td><td>{fmt(run.summary.wh_per_mile)} Wh/mi</td><td>{fmt(run.summary.range_miles)} mi</td><td>{new Date(run.created_at).toLocaleDateString()}</td><td><button className="icon-button" aria-label={`View ${run.name}`} title="Open result" onClick={()=>open(run.id)}><ArrowUpRight size={16}/></button></td></tr>)}</tbody></table></div>:<Blank title="No recorded simulations" action={onNew&&<button onClick={onNew}>Configure a simulation <ArrowUpRight size={15}/></button>}>Run a test to see measured model outputs here. Incomplete builds can be explored with explicit demo assumptions.</Blank>}</Panel>;
}
