import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {Part,Result} from '../types';
import {fmt} from '../api';

export function VehicleViewer({parts,result,compact=false}:{parts:Part[];result?:Result;compact?:boolean}){
 const mount=useRef<HTMLDivElement>(null),state=useRef({speed:0,time:0}),[playing,setPlaying]=useState(false),[cursor,setCursor]=useState(0),[selected,setSelected]=useState<Part|null>(null),[failure,setFailure]=useState('');
 const samples=result?.samples??[];
 useEffect(()=>{setCursor(0);setPlaying(false)},[result?.id]);
 useEffect(()=>{state.current.speed=(samples[cursor]?.speed_mph??0)*.44704;state.current.time=samples[cursor]?.time_s??0},[cursor,samples]);
 useEffect(()=>{if(!playing||samples.length<2)return;const start=performance.now(),initial=samples[cursor]?.time_s??0;const timer=setInterval(()=>{const time=initial+(performance.now()-start)/1000;const j=samples.findIndex(s=>s.time_s>=time);if(j<0){setPlaying(false);setCursor(samples.length-1)}else setCursor(j)},33);return()=>clearInterval(timer)},[playing,samples]);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch{setFailure('WebGL is unavailable. Enable hardware acceleration to view the schematic.');return}
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(5,3.8,5.3);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x111a20,1);host.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.45,0);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=15;
  scene.add(new THREE.HemisphereLight(0xd9edff,0x243242,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,3);scene.add(light);
  const grid=new THREE.GridHelper(12,30,0x3a515c,0x22323b);scene.add(grid);
  const chassis=parts.find(p=>p.category==='chassis')?.specs??{},drive=parts.find(p=>p.category==='drivetrain')?.specs??{};
  // Viewer defaults are visual geometry only, never simulation input.
  const length=chassis.length_m??3.2,width=chassis.width_m??1.5,wb=chassis.wheelbase_m??2.1,track=chassis.track_m??1.25,r=(drive.wheel_diameter_m??.56)/2;
  const meshes:THREE.Mesh[]=[],wheels:THREE.Mesh[]=[];
  const material=(color:number,opacity=1)=>new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.4,transparent:opacity<1,opacity});
  function box(size:number[],pos:number[],color:number,category:string,opacity=1){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),material(color,opacity));mesh.position.set(...pos as [number,number,number]);mesh.userData.category=category;scene.add(mesh);meshes.push(mesh);return mesh}
  box([length,.15,width],[0,.48,0],0x67838e,'chassis',.45);
  box([wb*.62,.24,width*.62],[-.12,.64,0],0x22b8a0,'battery');
  box([.48,.32,.5],[wb/2-.2,.7,0],0xefd091,'motor');
  box([.3,.15,.4],[wb/2-.2,.95,0],0x9aa9ec,'inverter');
  box([.12,.12,track],[wb/2,.42,0],0xb5c4d0,'drivetrain');
  box([wb,.08,.08],[0,.43,0],0x647c91,'drivetrain');
  for(const x of [-wb/2,wb/2])for(const z of [-track/2,track/2]){
   const wheel=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.19,32),material(0x20272e));wheel.rotation.x=Math.PI/2;wheel.position.set(x,r+.02,z);wheel.userData.category='tires';scene.add(wheel);meshes.push(wheel);wheels.push(wheel);
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*.5,r*.5,.2,8),material(0x9eafb9));wheel.add(hub);
   box([.08,.3,.08],[x,.45,z*.82],0xe6a55a,'suspension');
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=[0,0];
  const onDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY]};
  const click=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes)[0];setSelected(hit?parts.find(p=>p.category===hit.object.userData.category)??null:null)};
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',click);
  const resize=()=>{camera.aspect=host.clientWidth/Math.max(host.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight)};const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let frame=0,last=performance.now();function draw(now:number){const dt=Math.min((now-last)/1000,.1);last=now;wheels.forEach(w=>w.rotateY(state.current.speed/r*dt));grid.position.x=-(state.current.time*state.current.speed)%(.4);controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw)}frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose()}});grid.geometry.dispose();(grid.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove()}
 },[parts]);
 return <section className={'panel viewer '+(compact?'compact':'')}><div className="panel-title">Assembly / spatial overview<span>SCHEMATIC · THREE.JS</span></div><div className="viewport" ref={mount}>{failure&&<p>{failure}</p>}</div><div className="viewer-legend"><span><i className="dot teal"/> Battery</span><span><i className="dot gold"/> Motor</span><span><i className="dot violet"/> Inverter</span><small>Drag to orbit · Scroll to zoom · Click to inspect</small></div>{selected&&<div className="inspect"><b>{selected.name}</b> · {fmt(selected.mass_kg)} kg · {selected.manufacturer}<button onClick={()=>setSelected(null)}>Close</button><pre>{JSON.stringify(selected.specs,null,2)}</pre></div>}{!compact&&<div className="playback"><button disabled={!samples.length} onClick={()=>setPlaying(!playing)}>{playing?'Pause':'Play cycle'}</button><input aria-label="Simulation playback" type="range" min="0" max={Math.max(0,samples.length-1)} value={cursor} onChange={e=>{setPlaying(false);setCursor(+e.target.value)}}/><span>{fmt(samples[cursor]?.time_s)} s / {fmt(samples[cursor]?.speed_mph)} mph</span></div>}<p className="caption">Configuration visualization only. Geometry defaults are schematic; no 3D vehicle dynamics.</p></section>
}
