import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {Part,Result} from '../types';
import {fmt} from '../api';
import {HoverCard} from './HoverCard';
import type {HoveredPart} from './HoverCard';
import {sensorEntries,mountPosition,createSensorObject} from './sensorLayout';

export function VehicleViewer({parts,result,compact=false}:{parts:Part[];result?:Result;compact?:boolean}){
 const mount=useRef<HTMLDivElement>(null),state=useRef({speed:0,time:0}),[playing,setPlaying]=useState(false),[cursor,setCursor]=useState(0),[selected,setSelected]=useState<Part|null>(null),[failure,setFailure]=useState('');
 const samples=result?.samples??[];
 const [hovered,setHovered]=useState<HoveredPart|null>(null);
 const directionPins=useRef(new Map<string,HTMLSpanElement>());
 const sensors=sensorEntries(parts);
 const documentDraft=parts.some(p=>p.custom_parameters.document_project);
 const pending=parts.filter(p=>p.custom_parameters.placeholder);
 useEffect(()=>{setCursor(0);setPlaying(false)},[result?.id]);
 useEffect(()=>{state.current.speed=(samples[cursor]?.speed_mph??0)*.44704;state.current.time=samples[cursor]?.time_s??0},[cursor,samples]);
 useEffect(()=>{if(!playing||samples.length<2)return;const start=performance.now(),initial=samples[cursor]?.time_s??0;const timer=setInterval(()=>{const time=initial+(performance.now()-start)/1000;const j=samples.findIndex(s=>s.time_s>=time);if(j<0){setPlaying(false);setCursor(samples.length-1)}else setCursor(j)},33);return()=>clearInterval(timer)},[playing,samples]);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  setHovered(null);
  setSelected(null);setFailure('');
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch{setFailure('WebGL is unavailable. Enable hardware acceleration to view the schematic.');return}
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(5,3.8,5.3);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x111a20,1);host.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.45,0);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=15;
  scene.add(new THREE.HemisphereLight(0xd9edff,0x243242,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,3);scene.add(light);
  const grid=new THREE.GridHelper(12,30,0x3a515c,0x22323b);scene.add(grid);
  const chassis=parts.find(p=>p.category==='chassis')?.specs??{},drive=parts.find(p=>p.category==='drivetrain')?.specs??{};
  // Viewer defaults are visual geometry only, never simulation input.
  const length=chassis.length_m??3.2,width=chassis.width_m??1.5,wb=chassis.wheelbase_m??2.1,track=chassis.track_m??1.25,r=(drive.wheel_diameter_m??.56)/2;
  const meshes:THREE.Object3D[]=[],wheels:THREE.Mesh[]=[];
  const material=(color:number,opacity=1)=>new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.4,transparent:opacity<1,opacity});
  function box(size:number[],pos:number[],color:number,category:string,opacity=1){const part=parts.find(p=>p.category===category);const mat=material(color,opacity);if(part?.custom_parameters.placeholder){mat.wireframe=true;mat.color.setHex(0xbd9866)}const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),mat);mesh.position.set(...pos as [number,number,number]);mesh.userData.category=category;mesh.userData.partId=part?.id;scene.add(mesh);meshes.push(mesh);return mesh}
  box([length,.15,width],[0,.48,0],0x67838e,'chassis',.45);
  box([wb*.62,.24,width*.62],[-.12,.64,0],0x22b8a0,'battery');
  const motorCount=parts.find(p=>p.category==='motor')?.custom_parameters.installed_quantity??1;
  if(motorCount===2){for(const z of [-track*.32,track*.32])box([.34,.3,.3],[wb/2,.64,z],0xefd091,'motor')}
  else box([.48,.32,.5],[wb/2-.2,.7,0],0xefd091,'motor');
  box([.3,.15,.4],[wb/2-.2,.95,0],0x9aa9ec,'inverter');
  box([.12,.12,track],[wb/2,.42,0],0xb5c4d0,'drivetrain');
  box([wb,.08,.08],[0,.43,0],0x647c91,'drivetrain');
  if(documentDraft){
   box([.24,.2,.24],[-wb/2,.69,0],0xe4a768,'steering');
   box([.28,.05,.3],[.22,.88,.32],0x7399d8,'embedded_controllers');
   box([.18,.16,.16],[-wb/2,.91,0],0x74c9ca,'vision');
   box([.26,.05,.26],[wb/2-.3,.9,-.35],0x8297a9,'cooling');
   box([.12,.13,.12],[0,.93,-.4],0xda8580,'safety_controls');
   box([.22,.13,.2],[.36,.7,-.3],0x9697c9,'auxiliary');
   if(parts.some(p=>p.category==='sensors'&&p.custom_parameters.placeholder))box([.18,.18,.18],[-wb*.36,.66,.4],0x9697c9,'sensors');
   if(drive.drive_type==='belt'){
    box([.6,.03,.04],[wb/2-.4,.4,-.13],0x71bfa0,'drivetrain');
    box([.6,.03,.04],[wb/2-.4,.4,.13],0x71bfa0,'drivetrain');
   }
  }
  for(const x of [-wb/2,wb/2])for(const z of [-track/2,track/2]){
   const wheel=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.19,32),material(0x20272e));wheel.rotation.x=Math.PI/2;wheel.position.set(x,r+.02,z);wheel.userData.category='tires';scene.add(wheel);meshes.push(wheel);wheels.push(wheel);
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*.5,r*.5,.2,8),material(0x9eafb9));wheel.add(hub);
   box([.08,.3,.08],[x,.45,z*.82],0xe6a55a,'suspension');
  }
  const dimensions={length,width,wb,track,r};
  for(const sensor of sensorEntries(parts))for(const site of sensor.mounts){
   const object=createSensorObject(sensor.kind,site.site);
   object.position.set(...mountPosition(site.site,dimensions));
   object.userData.category='sensors';object.userData.partId=sensor.part.id;
   scene.add(object);meshes.push(object);
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=[0,0];
  const canvas=renderer.domElement;
  canvas.style.cursor='grab';
  function pick(e:PointerEvent){
   const rect=canvas.getBoundingClientRect();
   pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
   scene.updateMatrixWorld(true);camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);
   for(const hit of ray.intersectObjects(meshes,true)){
    let object:THREE.Object3D|null=hit.object;
    // Wheel hubs inherit their parent wheel's component identity.
    while(object&&!object.userData.category)object=object.parent;
    if(!object)continue;
    const data=object.userData;
    const part=parts.find(p=>data.partId?p.id===data.partId:p.category===data.category);
    if(part)return part;
   }
   return null;
  }
  let highlight:Part|null=null;
  function illuminate(part:Part|null){
   if(highlight===part)return;
   highlight=part;
   for(const mesh of meshes){
    const active=!!part&&(mesh.userData.partId?mesh.userData.partId===part.id:mesh.userData.category===part.category);
    mesh.traverse(child=>{if(child instanceof THREE.Mesh){const mat=child.material as THREE.MeshStandardMaterial;mat.emissive.setHex(active?0x44d8bb:0);mat.emissiveIntensity=active?.65:0}});
   }
  }
  const clearHover=()=>{illuminate(null);setHovered(null);canvas.style.cursor='grab'};
  const move=(e:PointerEvent)=>{
   if(e.buttons||e.pointerType==='touch'){clearHover();return}
   const part=pick(e);illuminate(part);canvas.style.cursor=part?'pointer':'grab';
   const rect=host.getBoundingClientRect();
   setHovered(part?{part,x:e.clientX-rect.left,y:e.clientY-rect.top,width:rect.width,height:rect.height}:null);
  };
  const onDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];clearHover();canvas.style.cursor='grabbing'};
  const click=(e:PointerEvent)=>{canvas.style.cursor='grab';if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;setSelected(pick(e))};
  canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointerup',click);
  canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',clearHover);
  controls.addEventListener('start',clearHover);
  const resize=()=>{camera.aspect=host.clientWidth/Math.max(host.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight)};const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const projected=new THREE.Vector3();
  function projectLabel(element:HTMLElement|undefined,position:THREE.Vector3){
   if(!element)return;
   projected.copy(position).project(camera);
   const visible=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<.97&&Math.abs(projected.y)<.94;
   element.style.visibility=visible?'visible':'hidden';
   element.style.left=(projected.x+1)*host!.clientWidth/2+'px';
   element.style.top=(1-projected.y)*host!.clientHeight/2+'px';
  }
  let frame=0,last=performance.now();function draw(now:number){
   const dt=Math.min((now-last)/1000,.1);last=now;
   wheels.forEach(w=>w.rotateY(state.current.speed/r*dt));grid.position.x=-(state.current.time*state.current.speed)%(.4);
   controls.update();renderer.render(scene,camera);
   projectLabel(directionPins.current.get('front'),new THREE.Vector3(-length/2-.28,.08,0));
   projectLabel(directionPins.current.get('rear'),new THREE.Vector3(length/2+.28,.08,0));
   frame=requestAnimationFrame(draw);
  }frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',click);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',clearHover);controls.removeEventListener('start',clearHover);controls.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose()}});grid.geometry.dispose();(grid.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove()}
 },[parts]);
 return <section className={'panel viewer '+(compact?'compact':'')}>
  <div className="panel-title">Assembly / spatial overview<span>SCHEMATIC · THREE.JS</span></div>
  {sensors.length>0&&<div className="sensor-toolbar"><span>{sensors.length} sensor types · {sensors.reduce((n,s)=>n+s.mounts.length,0)} estimated mounts</span></div>}
  <div className="viewport" ref={mount}>
   {failure&&<p>{failure}</p>}
   {sensors.length>0&&<div className="sensor-markers" hidden={!!failure}>
    {['front','rear'].map(direction=><span key={direction} className="vehicle-direction" ref={el=>{if(el)directionPins.current.set(direction,el);else directionPins.current.delete(direction)}}>{direction.toUpperCase()}</span>)}
   </div>}
   {hovered&&<HoverCard hover={hovered}/>}
  </div>
  <div className="viewer-legend"><span><i className="dot teal"/> Battery</span><span><i className="dot gold"/> Motor</span><span><i className="dot violet"/> Inverter</span><small>Drag to orbit · Scroll to zoom · Hover for description / Click to inspect</small></div>
  {sensors.length>0&&<details className="sensor-layout" open={!compact}>
   <summary>Estimated sensor placement · {sensors.length} types</summary>
   <p>Mounts and quantities are proposed. Small sensor models are enlarged for visibility. Hover or click a sensor to inspect it. Final brackets, clearances and wiring need measurements.</p>
   <div className="sensor-layout-grid">{sensors.map(sensor=><button key={sensor.part.id} className="sensor-location" onClick={()=>setSelected(sensor.part)}><b className="sensor-number">{sensor.number}</b><span><strong>{sensor.name}</strong><small>{sensor.mounts.map(m=>m.label).join(' · ')}</small></span><em>×{sensor.mounts.length}</em></button>)}</div>
  </details>}
  {documentDraft&&<div className="draft-view-notice"><b>Provisional parts assembly / geometry is illustrative</b><p>Outlined regions identify systems without specifications. All component sizes and positions are conceptual until mechanical drawings are supplied.</p><span>Pending: {pending.map(p=>p.category).join(', ')}</span></div>}
  {documentDraft&&!compact&&<div className="part-inspector-buttons">{parts.filter(p=>!p.custom_parameters.sensor_type).map(p=><button key={p.id} onClick={()=>setSelected(p)}>{p.category}{p.custom_parameters.placeholder?' / pending':''}</button>)}</div>}
  {selected&&<div className="inspect"><button onClick={()=>setSelected(null)}>Close</button><b>{selected.name}</b><p>{selected.mass_kg==null?'Installed mass unknown':fmt(selected.mass_kg)+' kg'} {selected.manufacturer&&' / '+selected.manufacturer}</p>
   {selected.custom_parameters.sensor_type&&<><h4>Estimated mounting locations</h4><ul>{sensorEntries([selected])[0]?.mounts.map(m=><li key={m.site}>{m.label}</li>)}</ul><p>Proposed quantity: {selected.custom_parameters.installed_quantity}. {selected.custom_parameters.quantity_basis}</p><p>{selected.custom_parameters.interface_notes}</p></>}
   {selected.notes&&<p>{selected.notes}</p>}{selected.datasheet&&<a href={selected.datasheet} target="_blank" rel="noreferrer">Supplied reference</a>}<pre>{JSON.stringify({specifications:selected.specs,units:selected.units,source:selected.custom_parameters.source_references,status:selected.custom_parameters.part_status},null,2)}</pre>
  </div>}
  {!compact&&<div className="playback"><button disabled={!samples.length} onClick={()=>setPlaying(!playing)}>{playing?'Pause':'Play cycle'}</button><input aria-label="Simulation playback" type="range" min="0" max={Math.max(0,samples.length-1)} value={cursor} onChange={e=>{setPlaying(false);setCursor(+e.target.value)}}/><span>{fmt(samples[cursor]?.time_s)} s / {fmt(samples[cursor]?.speed_mph)} mph</span></div>}
  <p className="caption">Configuration visualization only. Geometry defaults are schematic; no 3D vehicle dynamics.</p>
 </section>
}
