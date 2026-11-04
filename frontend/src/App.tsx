import {lazy,Suspense,useCallback,useEffect,useMemo,useState} from 'react';
import {LayoutDashboard,Boxes,Wrench,Box,FlaskConical,ChartNoAxesCombined,GitCompareArrows,FolderOpen,Zap,ArrowUpRight,Activity,Menu,X} from 'lucide-react';
import type {Part,Vehicle,Result,Assembly,Catalog} from './types';
import {api} from './api';
import {Alert,Blank,Skeleton} from './components/ui';
import {CarSelector} from './pages/CarSelector';
import {Overview} from './pages/Overview';
const Library=lazy(()=>import('./pages/Library').then(m=>({default:m.Library})));
const Builder=lazy(()=>import('./vehicle-builder/Builder').then(m=>({default:m.Builder})));
const Lab=lazy(()=>import('./simulator/Lab').then(m=>({default:m.Lab})));
const Results=lazy(()=>import('./pages/Results').then(m=>({default:m.Results})));
const Comparison=lazy(()=>import('./pages/Comparison').then(m=>({default:m.Comparison})));
const Projects=lazy(()=>import('./pages/Projects').then(m=>({default:m.Projects})));
const VehicleViewer=lazy(()=>import('./visualization/VehicleViewer').then(m=>({default:m.VehicleViewer})));
const DrivePlayback=lazy(()=>import('./visualization/DriveReplay').then(m=>({default:m.DrivePlayback})));
const nav=[['Home Dashboard',LayoutDashboard],['Component Library',Boxes],['Vehicle Builder',Wrench],['3D Vehicle Viewer',Box],['Simulation Lab',FlaskConical],['Performance Results',ChartNoAxesCombined],['Vehicle Comparison',GitCompareArrows],['Saved Projects',FolderOpen]] as const;
const subtitles=['Your selected configuration, engineering inputs and recorded performance.','Traceable specifications for every system in your vehicle.','Configure your assemblies and review the inputs your model needs.','Explore the vehicle. Inspect its systems. Replay a recorded drive.','Define a test, review assumptions and run the FASTSim model.','Recorded performance, engineering limits and reproducible inputs.','Compare recorded drives or run a controlled design experiment.','Saved configurations and their simulation history.'];
const groups=[{name:'DESIGN',pages:[0,3,2,1]},{name:'SIMULATE',pages:[4,5,6]},{name:'WORKSPACE',pages:[7]}];

export default function App(){
 const [narrow,setNarrow]=useState(()=>window.matchMedia('(max-width: 800px)').matches);
 const [choosing,setChoosing]=useState(true),[page,setPage]=useState(0),[mobileNav,setMobileNav]=useState(false),[runBusy,setRunBusy]=useState(false),[libraryFocus,setLibraryFocus]=useState<string>();
 const [parts,setParts]=useState<Part[]>([]),[vehicles,setVehicles]=useState<Vehicle[]>([]),[cycles,setCycles]=useState<{id:string;name:string}[]>([]),[runs,setRuns]=useState<Result[]>([]),[result,setResult]=useState<Result>();
 const [catalog,setCatalog]=useState<Catalog>({fields:{},required:{}}),[selected,setSelected]=useState(''),[assembly,setAssembly]=useState<Assembly>(),[error,setError]=useState(''),[version,setVersion]=useState(''),[loading,setLoading]=useState(true),[resultBusy,setResultBusy]=useState(false);
 const reload=useCallback(async()=>{
  try{
   const [p,v,c,r,cat,h]=await Promise.all([api<Part[]>('/components'),api<Vehicle[]>('/vehicles'),api<{id:string;name:string}[]>('/cycles'),api<Result[]>('/results'),api<Catalog>('/catalog'),api<{fastsim:string}>('/health')]);
   setParts(p);setVehicles(v);setCycles(c);setRuns(r);setCatalog(cat);setVersion(h.fastsim);setSelected(s=>v.some(x=>x.id===s)?s:'');setError('');
  }catch(e){setError(String(e))}finally{setLoading(false)}
 },[]);
 useEffect(()=>{void reload()},[reload]);
 useEffect(()=>{const media=window.matchMedia('(max-width: 800px)');const changed=()=>{setNarrow(media.matches);if(!media.matches)setMobileNav(false)};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed)},[]);
 useEffect(()=>{if(!mobileNav)return;const prior=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';document.querySelector<HTMLButtonElement>('.sidebar button.selected')?.focus();return()=>{document.body.style.overflow=overflow;prior?.focus()}},[mobileNav]);
 const vehicle=useMemo(()=>vehicles.find(v=>v.id===selected),[vehicles,selected]);
 const selectedParts=useMemo(()=>parts.filter(p=>vehicle?.component_ids.includes(p.id!)),[parts,vehicle]);
 useEffect(()=>{
  setAssembly(undefined);if(!vehicle)return;let active=true;
  api<Assembly>('/vehicles/validate',vehicle).then(a=>{if(active)setAssembly(a)}).catch(e=>{if(active)setError(String(e))});
  return()=>{active=false};
 },[vehicle,parts]);
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileNav(false)};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[]);
 function navigate(target:number){setPage(target);setMobileNav(false);window.scrollTo({top:0,behavior:'instant'})}
 function selectCar(id:string){setSelected(id);setResult(undefined)}
 function open(run:Result){setResult(run);if(vehicles.some(v=>v.id===run.request.vehicle_id))setSelected(run.request.vehicle_id);navigate(5);void reload()}
 async function loadResult(id:string,playback=false){
  setResultBusy(true);setError('');
  try{const run=await api<Result>('/results/'+id);if(playback){setResult(run);if(vehicles.some(v=>v.id===run.request.vehicle_id))setSelected(run.request.vehicle_id)}else open(run)}catch(e){setError(String(e))}finally{setResultBusy(false)}
 }
 const viewedParts=result?.assembly&&result.request.vehicle_id===selected?result.assembly.components??selectedParts:selectedParts;
 if(choosing||(!loading&&vehicles.length>0&&!vehicle&&page!==2))return <CarSelector vehicles={vehicles} parts={parts} loading={loading} error={error} onChoose={id=>{selectCar(id);navigate(0);setChoosing(false)}} onRetry={reload} onCreate={()=>{selectCar('');setChoosing(false);navigate(2)}}/>;
 return <div className="app">
  <a className="skip-link" tabIndex={mobileNav?-1:0} href="#workspace-main">Skip to workspace</a>
  {mobileNav&&<button className="nav-shade" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
  <aside className={`sidebar${mobileNav?' is-open':''}`} inert={narrow&&!mobileNav}>
   <button className="mobile-close icon-button" aria-label="Close navigation" onClick={()=>setMobileNav(false)}><X size={18}/></button>
   <a className="brand" href="#" onClick={e=>{e.preventDefault();if(!runBusy)navigate(0)}}><Zap size={24}/><div>EV / TWIN<small>ENGINEERING WORKSPACE</small></div></a>
   <div className="workspace"><span className="workspace-avatar">EV</span><div>Student EV project<small>Local engineering workspace</small></div></div>
   {groups.map(group=><div className="nav-group" key={group.name}><div className="nav-label">{group.name}</div><nav aria-label={group.name.toLowerCase()}>{group.pages.map(index=>{const [name,Icon]=nav[index];return <button key={name} className={page===index?'selected':''} aria-current={page===index?'page':undefined} disabled={runBusy} onClick={()=>navigate(index)}><Icon size={17} strokeWidth={1.7}/>{name}</button>})}</nav></div>)}
   <div className="sidebar-bottom"><div className="engine-icon"><Activity size={15}/>Simulation engine</div><b>FASTSim {version||'connecting…'}</b><small><span className="live-dot"/>{version?'Local API connected':'Connecting to backend'}</small><p>Longitudinal simulation<br/>Traceable component inputs</p></div>
  </aside>
  <main id="workspace-main" inert={narrow&&mobileNav}>
   <header className="app-header"><button className="mobile-menu icon-button quiet" aria-label="Open navigation" aria-expanded={mobileNav} onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb"><span className="breadcrumb-workspace">WORKSPACE</span><span>/</span>{nav[page][0]}</div><div className="workspace-car-switch"><span title={vehicle?.name}>{vehicle?.name}</span><button disabled={runBusy} onClick={()=>setChoosing(true)}>Change car</button></div></header>
   <div className="content">
    <div className="page-heading"><div><span className="eyebrow">{page<4?'VEHICLE ENGINEERING':page<7?'TEST & ANALYSIS':'PROJECT WORKSPACE'}</span><h1>{nav[page][0]}</h1><p>{subtitles[page]}</p></div>{page===0&&<button className="primary" onClick={()=>navigate(4)}><FlaskConical size={16}/>New simulation<ArrowUpRight size={15}/></button>}</div>
    {error&&<Alert tone="error" title="Workspace request failed" action={<button onClick={reload}>Retry connection</button>}>{error}</Alert>}
    {loading?<Skeleton rows={5}/>:<Suspense fallback={<section className="panel"><Skeleton rows={5} label="Loading workspace tools"/></section>}>
     {page===0&&<Overview vehicle={vehicle} vehicles={vehicles} parts={parts} installed={selectedParts} assembly={assembly} runs={runs} onSelect={selectCar} onNavigate={navigate} onResult={loadResult}/>}
     {page===1&&<Library parts={parts} catalog={catalog} reload={reload} initialPartId={libraryFocus} onOpened={()=>setLibraryFocus(undefined)}/>}
     {page===2&&<Builder key={selected} parts={parts} vehicles={vehicles} selected={selected} onSelect={selectCar} onLibrary={id=>{setLibraryFocus(id);navigate(1)}} onSave={async id=>{await reload();selectCar(id)}}/>}
     {page===3&&<><div className="toolbar"><select aria-label="Visualized vehicle" value={selected} onChange={e=>selectCar(e.target.value)}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><select aria-label="Playback result" disabled={resultBusy} value={result?.id??''} onChange={e=>{if(e.target.value)void loadResult(e.target.value,true);else setResult(undefined)}}><option value="">Current configuration · no playback</option>{runs.map(r=><option key={r.id} value={r.id}>{r.name} / {new Date(r.created_at).toLocaleDateString()}</option>)}</select></div>{resultBusy?<Skeleton rows={4}/>:<><VehicleViewer libraryParts={parts} parts={viewedParts} result={result?.request.vehicle_id===selected?result:undefined}/>{result&&result.request.vehicle_id===selected&&<DrivePlayback result={result} runs={runs}/>}</>}</>}
     {page===4&&<Lab vehicles={vehicles} cycles={cycles} selected={selected} onSelect={selectCar} onResult={open} reload={reload} runs={runs} onOpenResult={loadResult} onBusy={setRunBusy}/>}
     {page===5&&<><div className="toolbar"><select aria-label="Saved result" disabled={resultBusy} value={result?.id??''} onChange={e=>void loadResult(e.target.value)}><option value="" disabled>Select a saved simulation</option>{runs.map(r=><option key={r.id} value={r.id}>{r.name} / {new Date(r.created_at).toLocaleString()}</option>)}</select></div>{resultBusy?<Skeleton rows={5}/>:<><Results result={result} onSimulate={()=>navigate(4)}/>{result&&<details className="panel"><summary>Replay this test drive</summary><div className="disclosure-body"><DrivePlayback result={result} runs={runs}/></div></details>}</>}</>}
     {page===6&&<><DrivePlayback runs={runs}/><Comparison key={selected} vehicles={vehicles} selected={selected} open={open}/></>}
     {page===7&&<Projects vehicles={vehicles} runs={runs} onInspect={id=>{selectCar(id);navigate(3)}} onResult={loadResult} reload={reload}/>}
     {!vehicles.length&&page!==2&&<Blank title="Create your first vehicle" action={<button onClick={()=>navigate(2)}>Open Vehicle Builder</button>}>Your workspace is ready for a configuration.</Blank>}
    </Suspense>}
    <footer className="app-footer"><span>EV / TWIN · Local engineering workspace</span><span>Simulation estimates · Hardware validation required</span></footer>
   </div>
  </main>
 </div>;
}
