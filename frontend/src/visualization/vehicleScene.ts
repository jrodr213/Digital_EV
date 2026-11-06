import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {Part} from '../types';
import type {AssemblyId} from './assemblyNavigation';
import {createVehicleModel} from './vehicleModel';
import {assemblyForPart} from './assemblyNavigation';

type V3=[number,number,number];
export type SceneView={assembly:AssemblyId|null;part:Part|null;exploded:boolean};
export type SceneHit={assembly:AssemblyId;part?:Part};
export type CameraPreset='isometric'|'front'|'side'|'top';
export type VehicleScene={setView:(view:SceneView)=>void;fit:()=>void;orient:(preset:CameraPreset)=>void;reset:()=>void;dispose:()=>void};

// Presentation geometry only. This module never writes to the component data
// and never supplies dimensions, mass, power or geometry to the physics model.
export function createVehicleScene(host:HTMLDivElement,parts:Part[],allParts:Part[],callbacks:{pick:(hit:SceneHit)=>void;hover:(hit:SceneHit|null,x:number,y:number)=>void;wheelAngle:()=>number;orientation?:(preset:CameraPreset|'custom')=>void}):VehicleScene{
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
 renderer.setClearColor(0xe9edf0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.setAttribute('aria-label','Interactive car model. Use the assembly buttons to explore with a keyboard.');canvas.setAttribute('role','img');canvas.style.touchAction='none';host.prepend(canvas);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xe9edf0);scene.fog=new THREE.Fog(0xe9edf0,12,32);
 const camera=new THREE.PerspectiveCamera(34,1,.03,80);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.35;controls.maxDistance=13;controls.maxPolarAngle=Math.PI*.49;controls.enablePan=false;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
 scene.environment=environment.texture;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xffffff,0x7d9292,2.4));
 const key=new THREE.DirectionalLight(0xfff9ec,3.6);key.position.set(-3,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.035;key.shadow.bias=-.0002;key.shadow.radius=5;scene.add(key);
 const rim=new THREE.DirectionalLight(0xd1e8ff,2);rim.position.set(4,3,-4);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xe9edf0,roughness:1,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;floor.receiveShadow=true;scene.add(floor);
 const stage=new THREE.Mesh(new THREE.CylinderGeometry(2.55,2.6,.035,96),new THREE.MeshStandardMaterial({color:0xe2e8eb,roughness:.93}));stage.position.y=-.018;stage.receiveShadow=true;scene.add(stage);
 const stageRing=new THREE.Mesh(new THREE.TorusGeometry(2.48,.004,4,96),new THREE.MeshBasicMaterial({color:0xc2cdd3}));stageRing.rotation.x=Math.PI/2;stageRing.position.y=.004;scene.add(stageRing);

 const {root,exterior,surfaceGroups,partGroups,wheels,partMap}=createVehicleModel(parts,allParts);
 scene.add(root);

 let view:SceneView={assembly:null,part:null,exploded:false},animation=0,lastTime=performance.now(),transition=false,highlight:THREE.Object3D[]=[];
 const destination=new THREE.Vector3(),lookAt=new THREE.Vector3(),offsets=new Map<THREE.Group,THREE.Vector3>();
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let cameraPreset:CameraPreset|'custom'='isometric';
 const directions:Record<CameraPreset,V3>={isometric:[-1,.70,1.22],front:[-1,.08,0],side:[0,.08,1],top:[0,1,.001]};
 function orient(preset:CameraPreset){cameraPreset=preset;canvas.dataset.orientation=preset;callbacks.orientation?.(preset);fit()}
 function visibleBox(){
  const bounds=new THREE.Box3();
  if(!view.assembly)bounds.setFromObject(exterior);
  else for(const group of partGroups.values())if(group.visible)bounds.union(new THREE.Box3().setFromObject(group));
  if(bounds.isEmpty())bounds.set(new THREE.Vector3(-.5,.1,-.5),new THREE.Vector3(.5,.9,.5));
  return bounds;
 }
 function fit(immediate=false){
  scene.updateMatrixWorld(true);const bounds=visibleBox(),center=bounds.getCenter(new THREE.Vector3());
  const direction=(cameraPreset==='custom'?camera.position.clone().sub(controls.target):new THREE.Vector3(...directions[cameraPreset])).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*Math.max(.3,camera.aspect);let distance=0;
  // Fit the visible shapes, not empty corners of a single large bounding box.
  const fitGroups:THREE.Object3D[]=view.assembly?[...partGroups.values()].filter(g=>g.visible):[exterior];
  for(const group of fitGroups)group.traverse(object=>{if(object instanceof THREE.Mesh){
   const box=new THREE.Box3().setFromObject(object);
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const relative=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,relative.dot(direction)+Math.max(Math.abs(relative.dot(right))/tanH,Math.abs(relative.dot(up))/tanV));
   }
  }});
  distance=Math.max(.65,distance*1.12);lookAt.copy(center);destination.copy(center).addScaledVector(direction,distance);
  if(immediate||reducedMotion){camera.position.copy(destination);controls.target.copy(lookAt);camera.lookAt(lookAt);transition=false}else transition=true;
 }
 const originalEmission=new Map<THREE.MeshStandardMaterial,{color:THREE.Color;intensity:number}>();
 function clearHighlight(){
  highlight.forEach(group=>group.traverse(object=>{if(object instanceof THREE.Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>{if(material instanceof THREE.MeshStandardMaterial){const original=originalEmission.get(material);if(original){material.emissive.copy(original.color);material.emissiveIntensity=original.intensity}}})}}));highlight=[];
 }
 function setView(next:SceneView){
  clearHighlight();view=next;exterior.visible=!view.assembly;offsets.clear();
  for(const [id,group] of partGroups){
   const part=partMap.get(id)!;
   group.visible=!!view.assembly&&(view.part?(view.part.id??view.part.name)===id:assemblyForPart(part)===view.assembly&&parts.some(p=>(p.id??p.name)===id));
   const offset=new THREE.Vector3();
   if(view.exploded&&!view.part){
    const shifts:Record<string,V3>={chain_protection:[0,.28,0],motor_mounts:[-.12,-.14,0],inverter:[.15,.16,0],embedded_controllers:[-.14,.15,0],rear_sprockets:[.12,0,0],motor_sprockets:[-.1,.05,0],drivetrain:[0,-.1,0],brakes:[.10,.12,0],suspension:[0,.18,0],signal_interface:[-.25,0,0],cooling:[.2,.12,0]};
    if(shifts[part.category])offset.set(...shifts[part.category]);
   }
   offsets.set(group,offset);group.position.copy(offset);
  }
  canvas.dataset.view=view.part?'component':view.assembly?'assembly':'full';canvas.dataset.assembly=view.assembly??'';
  callbacks.hover(null,0,0);fit();
 }
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0};
 function pick(event:PointerEvent):SceneHit|null{
  const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);scene.updateMatrixWorld(true);camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);
  const targets:THREE.Object3D[]=view.assembly?[...partGroups.values()].filter(g=>g.visible):surfaceGroups;
  for(const hit of ray.intersectObjects(targets,true)){
   let object:THREE.Object3D|null=hit.object;
   while(object&&!object.userData.assembly)object=object.parent;
   if(!object)continue;
   const id=object.userData.partId,part=id?partMap.get(id):undefined;
   return {assembly:object.userData.assembly as AssemblyId,part};
  }return null;
 }
 function hover(event:PointerEvent){
  if(event.buttons){clearHighlight();callbacks.hover(null,0,0);return;}
  const hit=pick(event);clearHighlight();canvas.style.cursor=hit?'pointer':'grab';
  if(hit){highlight=view.assembly?[partGroups.get(hit.part?.id??hit.part?.name??'')!].filter(Boolean):surfaceGroups.filter(g=>g.userData.assembly===hit.assembly);highlight.forEach(group=>group.traverse(object=>{if(object instanceof THREE.Mesh){const material=object.material;if(material instanceof THREE.MeshStandardMaterial){if(!originalEmission.has(material))originalEmission.set(material,{color:material.emissive.clone(),intensity:material.emissiveIntensity});material.emissive.setHex(0x4b9988);material.emissiveIntensity=.20}}}))}
  const rect=canvas.getBoundingClientRect();callbacks.hover(hit,event.clientX-rect.left,event.clientY-rect.top);
 }
 function pointerDown(event:PointerEvent){down={x:event.clientX,y:event.clientY};transition=false;clearHighlight();callbacks.hover(null,0,0);canvas.style.cursor='grabbing'}
 function pointerUp(event:PointerEvent){canvas.style.cursor='grab';if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;const hit=pick(event);if(hit)callbacks.pick(hit)}
 function leave(){clearHighlight();callbacks.hover(null,0,0);canvas.style.cursor='grab'}
 function manual(){transition=false;cameraPreset='custom';canvas.dataset.orientation='custom';callbacks.orientation?.('custom');leave()}
 canvas.addEventListener('pointermove',hover);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointerleave',leave);controls.addEventListener('start',manual);
 const resize=()=>{camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);fit(true)};
 const observer=new ResizeObserver(resize);observer.observe(host);resize();fit(true);
 function draw(now:number){
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(transition){const t=1-Math.exp(-dt*8);camera.position.lerp(destination,t);controls.target.lerp(lookAt,t);if(camera.position.distanceToSquared(destination)<.00001)transition=false;}
  // Absolute angle from saved motion: no frame-rate drift or rotation while paused.
  const angle=callbacks.wheelAngle();wheels.forEach(w=>{w.rotation.z=-angle});
  canvas.dataset.wheelRadians=angle.toFixed(6);
  canvas.dataset.cameraPosition=camera.position.toArray().map(value=>value.toFixed(3)).join(',');
  controls.update();renderer.render(scene,camera);animation=requestAnimationFrame(draw);
 }
 animation=requestAnimationFrame(draw);
 return {setView,fit:()=>fit(),orient,reset:()=>orient('isometric'),dispose:()=>{
  cancelAnimationFrame(animation);observer.disconnect();canvas.removeEventListener('pointermove',hover);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointerleave',leave);controls.removeEventListener('start',manual);controls.dispose();
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m))}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();canvas.remove();
 }};
}
