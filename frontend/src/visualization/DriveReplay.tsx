import {useEffect,useMemo,useState} from 'react';
import {Pause,Play,RotateCcw} from 'lucide-react';
import {api,fmt} from '../api';
import type {Result} from '../types';
import {driveFrame,MPS_PER_MPH,prepareDriveTrace,sameDriveConditions} from './playbackMotion';
import {usePlaybackClock} from './usePlaybackClock';
import './drivePlayback.css';

const colors=['#739f91','#8297aa','#aeaca3'];

export function DrivePlayback({result,runs}:{result?:Result;runs:Result[]}){
 const [ids,setIds]=useState<[string,string,string]>([result?.id??'','','']);
 const [saved,setSaved]=useState<Result[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [span,setSpan]=useState(250);
 useEffect(()=>{if(result)setIds(previous=>[result.id,...previous.slice(1).map(id=>id===result.id?'':id)] as [string,string,string])},[result?.id]);
 const selection=ids.join('|');
 useEffect(()=>{
  let active=true;setError('');setSaved([]);const selected=ids.filter(Boolean);setLoading(selected.length>0);
  Promise.all(selected.map(id=>result?.id===id?Promise.resolve(result):api<Result>('/results/'+encodeURIComponent(id))))
   .then(values=>{if(active)setSaved(values)}).catch(e=>{if(active)setError(String(e))}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[selection,result]);
 const prepared=useMemo(()=>saved.map(run=>{try{return {run,trace:prepareDriveTrace(run),error:''}}catch(e){return {run,trace:null,error:String(e)}}}),[saved]);
 const valid=prepared.filter((entry):entry is typeof entry&{trace:NonNullable<typeof entry.trace>}=>entry.trace!==null);
 const duration=Math.max(0,...valid.map(entry=>entry.trace.duration));
 const clock=usePlaybackClock(duration,selection);
 const frames=valid.map(entry=>driveFrame(entry.trace,clock.time));
 const extent=Math.max(10,...valid.map(entry=>entry.trace.totalDistance));
 const axisMax=span||Math.ceil(extent/10)*10,viewStart=span?Math.max(0,...frames.map(frame=>frame.distance-span*.75)):0;
 const width=1000,left=70,right=930,trackWidth=right-left;
 const height=80+Math.max(1,valid.length)*106;
 const mismatched=valid.length>1&&valid.slice(1).some(entry=>!sameDriveConditions(valid[0].run,entry.run));
 const options=[...runs];if(result&&!options.some(r=>r.id===result.id))options.push(result);
 function choose(index:number,id:string){clock.seek(0);setIds(previous=>previous.map((value,i)=>i===index?id:value) as [string,string,string])}
 return <section className="panel drive-playback" aria-label="Synchronized test-drive replay">
  <div className="drive-heading"><div><span className="eyebrow">SAVED TEST DRIVES</span><h2>Synchronized drive replay</h2><p>Compare achieved motion on one clock and one distance scale.</p></div><span className="drive-basis">STRAIGHT-LINE REPLAY</span></div>
  <div className="drive-selectors">{['Reference test drive','Compare test drive 2','Compare test drive 3'].map((label,index)=><label key={label}>{label}<select aria-label={label} value={ids[index]} onChange={e=>choose(index,e.target.value)}><option value="">{index?'No comparison':'Select a saved test drive'}</option>{[...options].reverse().map(run=><option key={run.id} value={run.id} disabled={ids.some((id,i)=>i!==index&&id===run.id)}>{run.name} / {new Date(run.created_at).toLocaleString()}</option>)}</select></label>)}</div>
  {error&&<p role="alert" className="drive-warning">{error}</p>}
  {prepared.filter(entry=>entry.error).map(entry=><p role="alert" className="drive-warning" key={entry.run.id}>{entry.run.name}: {entry.error}</p>)}
  {mismatched&&<p className="drive-warning">These runs use different test conditions or requested speed schedules. Motion stays on the same scale; performance differences include those changes.</p>}
  {valid.some(entry=>entry.run.request.demo_mode)&&<p className="drive-warning">Demo estimates use each run’s saved assumptions. This animation does not validate the assumed hardware.</p>}
  {valid.some(entry=>entry.run.analytical?.can_start===false)&&<p className="drive-warning">Torque shortfall: a saved power-flow trace shows motion that its analytical torque model cannot support. This replays the recorded trace; it does not resolve that physical limitation.</p>}
  {!valid.length?<p className="drive-empty">{loading?'Loading saved motion…':'Choose a saved test drive to animate it. No new simulation is needed.'}</p>:<>
   <div className="drive-controls"><button onClick={clock.toggle} disabled={loading||duration<=0}>{clock.playing?<Pause size={15}/>:<Play size={15}/>} {clock.playing?'Pause replay':'Play replay'}</button><button onClick={()=>clock.seek(0)} aria-label="Restart replay"><RotateCcw size={15}/></button><label>Playback speed <select aria-label="Replay speed" value={clock.rate} onChange={e=>clock.setRate(Number(e.target.value))}>{[.25,.5,1,2,5,10].map(rate=><option value={rate} key={rate}>{rate}×</option>)}</select></label><label>Distance view <select aria-label="Replay distance view" value={span} onChange={e=>setSpan(Number(e.target.value))}>{[50,250,1000,0].map(value=><option value={value} key={value}>{value?`${value} m · follow leader`:'Full recording'}</option>)}</select></label><output aria-label="Replay time">{fmt(clock.time,2)} / {fmt(duration,2)} s</output></div>
   <div className="drive-scrubber"><input type="range" aria-label="Drive replay time" min="0" max={duration} step="0.01" value={clock.time} onChange={e=>clock.seek(Number(e.target.value))}/></div>
   <div className="drive-road"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cars moving along parallel lanes on a common distance scale" data-time={clock.time.toFixed(3)}>
    <defs><linearGradient id="drive-road-surface" x2="0" y2="1"><stop stopColor="#253339"/><stop offset="1" stopColor="#18252c"/></linearGradient></defs>
    <rect x="22" y="18" width="956" height={height-62} rx="12" fill="url(#drive-road-surface)"/>
    {Array.from({length:6},(_,i)=>{const x=left+trackWidth*i/5;return <g key={i}><line x1={x} x2={x} y1="20" y2={height-44} stroke="#40515b" strokeDasharray="3 6"/><text x={x} y={height-16} textAnchor="middle" fill="#a4b5be" fontSize="13">{fmt(viewStart+axisMax*i/5,0)} m</text></g>})}
    {valid.map((entry,index)=>{const frame=frames[index],x=left+(frame.distance-viewStart)/axisMax*trackWidth,y=74+index*106;const degrees=(frame.wheelAngle??0)*180/Math.PI,inView=x>=left&&x<=right;
     return <g key={entry.run.id} data-run-id={entry.run.id} data-distance-m={frame.distance.toFixed(6)} data-speed-mps={frame.speedMps.toFixed(6)} data-wheel-radians={frame.wheelAngle?.toFixed(6)??'unknown'}>
      <line x1={left} x2={right} y1={y+19} y2={y+19} stroke="#64717a"/><line x1={left} x2={Math.max(left,Math.min(right,x))} y1={y+19} y2={y+19} stroke={colors[index]} strokeWidth="3" opacity=".7"/>
      <text x="40" y={y-24} fill={colors[index]} fontSize="16" fontWeight="600">{String.fromCharCode(65+index)}</text>
      <g transform={`translate(${x},${y})`} data-car-position={x.toFixed(6)} visibility={inView?'visible':'hidden'}>
       <path d="M-38 5 L-35-8 L-22-12 L-13-24 L10-24 L24-12 L35-7 L39 5 Z" fill={colors[index]} stroke="#102b2c" strokeWidth="1.5"/>
       <path d="M-17-13 L-10-21 L7-21 L17-13 Z" fill="#233940"/><path d="M-31-4 H29" stroke="#e9f0dc" strokeWidth="2" opacity=".7"/>
       {[-24,25].map(wheel=><g transform={`translate(${wheel},7) rotate(${degrees})`} key={wheel} data-wheel-angle={degrees.toFixed(6)}><circle r="9" fill="#0e1b21"/><circle r="5.7" fill="#a2b4ba"/><path d="M-5 0H5M0-5V5" stroke="#24343d" strokeWidth="1.8"/></g>)}
       <rect x="33" y="-6" width="4" height="4" rx="1" fill="#fff8cb"/>
      </g>
      {!inView&&<text x={left+10} y={y} fill={colors[index]} fontSize="13">← {fmt(viewStart-frame.distance,0)} m behind visible window · choose Full recording to see all positions</text>}
      {frame.ended&&<text x={right} y={y-30} textAnchor="end" fill="#afbec4" fontSize="12">End of recording</text>}
     </g>;
    })}
   </svg></div>
   <div className="drive-readouts">{valid.map((entry,index)=>{const frame=frames[index];return <article key={entry.run.id} style={{borderTopColor:colors[index]}}><span className="drive-run-label" style={{color:index===0?'var(--accent)':'var(--muted)'}}>{String.fromCharCode(65+index)} · {entry.run.request.demo_mode?'DEMO ESTIMATE':'SAVED SIMULATION'}</span><h3>{entry.run.name}</h3><dl><div><dt>Achieved speed</dt><dd>{fmt(frame.speedMps/MPS_PER_MPH,2)} mph</dd></div><div><dt>Distance</dt><dd>{fmt(frame.distance,2)} m</dd></div><div><dt>Battery SOC</dt><dd>{frame.soc==null?'—':`${fmt(frame.soc*100,1)}%`}</dd></div></dl><small>{entry.trace.nativeDistance?'Recorded FASTSim distance':'Distance integrated from saved achieved speed (older result)'}{entry.trace.wheelRadius==null?' · Wheel diameter unavailable; wheel rotation is not inferred.':''}{frame.ended?' · End of recording; final position held.':''}</small></article>})}</div>
   <p className="drive-caption">Every car uses the same elapsed seconds and metres. Playback speed changes viewing time only. Wheels follow distance ÷ saved wheel radius; pause and scrubbing preserve position. Car icons are schematic. This replays longitudinal results, without steering, tire slip, suspension or new physics calculations.</p>
  </>}
 </section>;
}
