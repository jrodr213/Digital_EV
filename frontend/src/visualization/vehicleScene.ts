import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {Part} from '../types';
import {assemblyForPart} from './assemblyNavigation';
import type {AssemblyId} from './assemblyNavigation';
import {createSensorObject,mountPosition,sensorEntries} from './sensorLayout';

type V3=[number,number,number];
type Pbr=THREE.MeshStandardMaterial;
export type SceneView={assembly:AssemblyId|null;part:Part|null;exploded:boolean};
export type SceneHit={assembly:AssemblyId;part?:Part};
export type VehicleScene={setView:(view:SceneView)=>void;fit:()=>void;dispose:()=>void};

// Presentation geometry only. This module never writes to the component data
// and never supplies dimensions, mass, power or geometry to the physics model.
export function createVehicleScene(host:HTMLDivElement,parts:Part[],allParts:Part[],callbacks:{pick:(hit:SceneHit)=>void;hover:(hit:SceneHit|null,x:number,y:number)=>void;speed:()=>number}):VehicleScene{
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
 renderer.setClearColor(0xe5eae6);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.setAttribute('aria-label','Interactive car model. Use the assembly buttons to explore with a keyboard.');canvas.setAttribute('role','img');canvas.style.touchAction='none';host.prepend(canvas);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xe5eae6);scene.fog=new THREE.Fog(0xe5eae6,12,32);
 const camera=new THREE.PerspectiveCamera(34,1,.03,80);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.35;controls.maxDistance=13;controls.maxPolarAngle=Math.PI*.49;controls.enablePan=false;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
 scene.environment=environment.texture;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xffffff,0x7d9292,2.4));
 const key=new THREE.DirectionalLight(0xfff9ec,3.6);key.position.set(-3,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.035;key.shadow.bias=-.0002;key.shadow.radius=5;scene.add(key);
 const rim=new THREE.DirectionalLight(0xd1e8ff,2);rim.position.set(4,3,-4);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xe5eae6,roughness:1,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;floor.receiveShadow=true;scene.add(floor);
 const stage=new THREE.Mesh(new THREE.CylinderGeometry(2.55,2.6,.035,96),new THREE.MeshStandardMaterial({color:0xdbe2dc,roughness:.93}));stage.position.y=-.018;stage.receiveShadow=true;scene.add(stage);
 const stageRing=new THREE.Mesh(new THREE.TorusGeometry(2.48,.004,4,96),new THREE.MeshBasicMaterial({color:0xb6c6be}));stageRing.rotation.x=Math.PI/2;stageRing.position.y=.004;scene.add(stageRing);

 const chassis=parts.find(p=>p.category==='chassis')?.specs??{},drive=parts.find(p=>p.category==='drivetrain')?.specs??{};
 const length=chassis.length_m??3.2,width=chassis.width_m??1.5,wb=chassis.wheelbase_m??2.1,track=chassis.track_m??1.4,r=(drive.wheel_diameter_m??.56)/2;
 const dims={length,width,wb,track,r};
 const motorCount=parts.find(p=>p.category==='motor')?.custom_parameters.installed_quantity??1;
 const paint=new THREE.MeshPhysicalMaterial({color:0x2c756f,metalness:.38,roughness:.24,clearcoat:1,clearcoatRoughness:.2});
 const cream=new THREE.MeshPhysicalMaterial({color:0xe8e5d8,metalness:.23,roughness:.26,clearcoat:.8});
 const dark=new THREE.MeshStandardMaterial({color:0x202c2d,metalness:.35,roughness:.5});
 const rubber=new THREE.MeshStandardMaterial({color:0x151b1d,roughness:.86});
 const silver=new THREE.MeshStandardMaterial({color:0xaebbbd,metalness:.85,roughness:.26});
 const gold=new THREE.MeshStandardMaterial({color:0xbd9361,metalness:.73,roughness:.32});
 const pcb=new THREE.MeshStandardMaterial({color:0x276d60,metalness:.25,roughness:.4});
 const graphite=new THREE.MeshStandardMaterial({color:0x3d484d,metalness:.65,roughness:.36});
 const violet=new THREE.MeshStandardMaterial({color:0x8b91be,metalness:.3,roughness:.4});
 const exterior=new THREE.Group();scene.add(exterior);
 const internals=new THREE.Group();scene.add(internals);
 const surfaceGroups:THREE.Group[]=[],partGroups=new Map<string,THREE.Group>(),wheels:THREE.Group[]=[];
 const partMap=new Map(allParts.map(p=>[p.id??p.name,p]));

 function mesh(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:Pbr,pos:V3=[0,0,0]){
  const object=new THREE.Mesh(geometry,material.clone());object.position.set(...pos);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
 }
 function rounded(parent:THREE.Object3D,size:V3,pos:V3,material:Pbr=dark,radius=.025){return mesh(parent,new RoundedBoxGeometry(...size,3,Math.min(radius,...size.map(n=>n/2.2))),material,pos)}
 function cylinder(parent:THREE.Object3D,radius:number,height:number,pos:V3,material:Pbr=silver,axis:'x'|'y'|'z'='z',segments=32){
  const object=mesh(parent,new THREE.CylinderGeometry(radius,radius,height,segments),material,pos);if(axis==='z')object.rotation.x=Math.PI/2;if(axis==='x')object.rotation.z=Math.PI/2;return object;
 }
 function tube(parent:THREE.Object3D,from:V3,to:V3,radius=.025,material:Pbr=silver){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
  const object=mesh(parent,new THREE.CylinderGeometry(radius,radius,delta.length(),12),material);object.position.copy(a.add(b).multiplyScalar(.5));object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return object;
 }
 function surface(assembly:AssemblyId){const group=new THREE.Group();group.userData.assembly=assembly;exterior.add(group);surfaceGroups.push(group);return group}
 function gear(parent:THREE.Object3D,radius:number,pos:V3,teeth:number){
  const shape=new THREE.Shape();for(let i=0;i<teeth*4;i++){const angle=i/(teeth*4)*Math.PI*2,rad=radius*(i%4===0||i%4===3?.92:1);const x=Math.cos(angle)*rad,y=Math.sin(angle)*rad;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y)}shape.closePath();
  const hole=new THREE.Path();hole.absarc(0,0,radius*.2,0,Math.PI*2,true);shape.holes.push(hole);
  const object=mesh(parent,new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false,steps:1}),gold,pos);object.position.z-=.009;
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;cylinder(parent,radius*.13,.021,[pos[0]+Math.cos(a)*radius*.57,pos[1]+Math.sin(a)*radius*.57,pos[2]],dark)}
 }
 function wheel(parent:THREE.Object3D,x:number,z:number){
  const group=new THREE.Group();group.position.set(x,r+.04,z);parent.add(group);wheels.push(group);
  mesh(group,new THREE.TorusGeometry(r*.72,r*.28,16,48),rubber);
  cylinder(group,r*.76,.14,[0,0,0],rubber);cylinder(group,r*.58,.16,[0,0,0],graphite);
  for(const side of [-1,1]){
   mesh(group,new THREE.TorusGeometry(r*.57,.015,8,40),silver,[0,0,side*.085]);
   cylinder(group,r*.16,.035,[0,0,side*.095],silver);
   for(let i=0;i<5;i++){const angle=i/5*Math.PI*2;const spoke=rounded(group,[r*.42,.026,.018],[Math.cos(angle)*r*.35,Math.sin(angle)*r*.35,side*.09],silver,.008);spoke.rotation.z=angle}
   for(let i=0;i<5;i++){const angle=i/5*Math.PI*2;cylinder(group,.009,.008,[Math.cos(angle)*r*.12,Math.sin(angle)*r*.12,side*.118],dark)}
  }
  return group;
 }

 // A possible finished body, cockpit and trim. These visual-only surfaces are
 // entry points to real saved assemblies; they are not additional BOM parts.
 const body=surface('frame');
 rounded(body,[length*.96,.19,width*.71],[0,.46,0],dark,.085);
 for(const z of [-width*.34,width*.34]){
  rounded(body,[length*.84,.25,.20],[0,.63,z],paint,.08);
  rounded(body,[length*.77,.035,.028],[-.05,.57,z*1.12],cream,.013);
 }
 const batteryHood=surface('battery');
 const hoodShape=new THREE.Shape();hoodShape.moveTo(-length*.49,.54);hoodShape.lineTo(-length*.48,.70);hoodShape.quadraticCurveTo(-length*.40,.87,-length*.22,.86);hoodShape.lineTo(-length*.12,.67);hoodShape.lineTo(-length*.13,.54);hoodShape.closePath();
 const hood=mesh(batteryHood,new THREE.ExtrudeGeometry(hoodShape,{depth:width*.64,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3,steps:1}),paint);hood.position.z=-width*.32;
 for(const z of [-.055,.055])rounded(batteryHood,[.64,.006,.018],[-length*.34,.85,z],cream,.003);
 const rear=surface('powertrain');rounded(rear,[length*.27,.28,width*.65],[length*.33,.70,0],paint,.10);
 for(let i=0;i<7;i++)rounded(rear,[.020,.012,width*.38],[length*.26+i*.05,.847,0],dark,.006);
 const cockpit=surface('steering');rounded(cockpit,[length*.36,.13,width*.47],[-.08,.63,0],dark,.07);
 const seatMat=new THREE.MeshStandardMaterial({color:0xc8bca3,roughness:.85,metalness:0});
 rounded(cockpit,[.53,.16,.47],[.20,.76,0],seatMat,.06);
 const backrest=rounded(cockpit,[.15,.54,.50],[.49,.99,0],seatMat,.06);backrest.rotation.z=-.17;
 for(const z of [-.12,.12])rounded(cockpit,[.012,.35,.018],[.405,1.0,z],dark,.005);
 const hoop=surface('frame');const hoopCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.57,.64,-.35),new THREE.Vector3(.61,1.20,-.35),new THREE.Vector3(.61,1.34,-.24),new THREE.Vector3(.61,1.34,.24),new THREE.Vector3(.61,1.20,.35),new THREE.Vector3(.57,.64,.35)]);
 mesh(hoop,new THREE.TubeGeometry(hoopCurve,48,.026,10,false),graphite);
 const steeringWheel=new THREE.Group();steeringWheel.position.set(-.39,.98,0);steeringWheel.rotation.y=Math.PI/2;steeringWheel.rotation.z=-.2;cockpit.add(steeringWheel);
 mesh(steeringWheel,new THREE.TorusGeometry(.125,.017,10,40),dark);
 for(const angle of [Math.PI/2,7*Math.PI/6,11*Math.PI/6])tube(steeringWheel,[0,0,0],[Math.cos(angle)*.115,Math.sin(angle)*.115,0],.009,silver);
 cylinder(steeringWheel,.033,.022,[0,0,0],paint);
 tube(cockpit,[-.48,.65,0],[-.39,.98,0],.018,graphite);
 const glass=new THREE.MeshPhysicalMaterial({color:0x4b6a69,roughness:.12,metalness:.05,transparent:true,opacity:.36,side:THREE.DoubleSide});
 const screen=rounded(cockpit,[.024,.27,.74],[-.66,.96,0],glass,.01);screen.rotation.z=.3;screen.castShadow=false;
 const electronics=surface('electronics');rounded(electronics,[.18,.06,.47],[-.55,.84,0],dark,.018);
 const displayMat=new THREE.MeshStandardMaterial({color:0x82e1cc,emissive:0x3a8e7d,emissiveIntensity:.65,roughness:.3});rounded(electronics,[.11,.008,.22],[-.55,.875,0],displayMat,.008);
 for(const z of [-.18,.18])cylinder(electronics,.017,.009,[-.55,.881,z],silver,'y');
 const lights=surface('frame'),headlamp=new THREE.MeshStandardMaterial({color:0xf8fff0,emissive:0xdae9ce,emissiveIntensity:1.5,roughness:.2});
 for(const z of [-width*.22,width*.22]){
  rounded(lights,[.04,.075,.30],[-length*.49,.64,z],dark,.02);
  rounded(lights,[.046,.025,.24],[-length*.495,.653,z],headlamp,.011);
  const tail=new THREE.MeshStandardMaterial({color:0xc14f41,emissive:0xb52c1f,emissiveIntensity:.8});rounded(lights,[.025,.032,.23],[length*.47,.72,z],tail,.01);
 }
 tube(lights,[-length*.52,.36,-width*.37],[-length*.52,.36,width*.37],.032,graphite);
 for(const z of [-width*.24,width*.24])tube(lights,[-length*.46,.43,z],[-length*.52,.36,z],.018,graphite);
 const wheelSurfaces=surface('wheels');
 for(const x of [-wb/2,wb/2])for(const z of [-track/2,track/2]){
  wheel(wheelSurfaces,x,z);
  const points=Array.from({length:25},(_,i)=>{const a=Math.PI*.08+i/24*Math.PI*.84;return new THREE.Vector3(x+Math.cos(a)*r*1.16,r+.04+Math.sin(a)*r*1.16,z)});
  mesh(wheelSurfaces,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.028,8,false),paint);
 }
 const vision=surface('sensors');rounded(vision,[.13,.09,.18],[-.94,.90,0],dark,.02);cylinder(vision,.026,.025,[-1.015,.91,0],silver,'x');cylinder(vision,.019,.028,[-1.028,.91,0],glass,'x');

 function board(group:THREE.Group,pos:V3){
  rounded(group,[.29,.025,.16],pos,pcb,.008);
  rounded(group,[.15,.035,.12],[pos[0]+.03,pos[1]+.03,pos[2]],silver,.004);
  rounded(group,[.06,.045,.07],[pos[0]-.12,pos[1]+.025,pos[2]],graphite,.004);
  for(const side of [-1,1])for(let j=0;j<8;j++)rounded(group,[.012,.045,.014],[pos[0]-.10+j*.027,pos[1]-.017,pos[2]+side*.077],gold,.002);
 }
 function chain(group:THREE.Group,z:number){
  const a=new THREE.Vector2(.30,.67),b=new THREE.Vector2(wb/2,.34),ra=.075,rb=.19,delta=b.clone().sub(a),theta=Math.atan2(delta.y,delta.x),phi=Math.acos((ra-rb)/delta.length()),hi=theta+phi,lo=theta-phi;
  const points:THREE.Vector3[]=[];
  const pt=(c:THREE.Vector2,rad:number,angle:number)=>new THREE.Vector3(c.x+Math.cos(angle)*rad,c.y+Math.sin(angle)*rad,z);
  const ah=pt(a,ra,hi),bh=pt(b,rb,hi),bl=pt(b,rb,lo),al=pt(a,ra,lo);
  for(let i=0;i<12;i++)points.push(ah.clone().lerp(bh,i/12));
  for(let i=0;i<28;i++)points.push(pt(b,rb,hi+(lo-hi)*i/28));
  for(let i=0;i<12;i++)points.push(bl.clone().lerp(al,i/12));
  for(let i=0;i<24;i++)points.push(pt(a,ra,lo+(hi-Math.PI*2-lo)*i/24));
  const curve=new THREE.CatmullRomCurve3(points,true,'centripetal');
  mesh(group,new THREE.TubeGeometry(curve,128,.012,5,true),graphite);
  const links=new THREE.InstancedMesh(new THREE.BoxGeometry(.030,.021,.031),silver.clone(),64),dummy=new THREE.Object3D();
  for(let i=0;i<64;i++){const t=i/64;dummy.position.copy(curve.getPointAt(t));dummy.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),curve.getTangentAt(t).normalize());dummy.updateMatrix();links.setMatrixAt(i,dummy.matrix)}group.add(links);
 }

 function buildPart(part:Part,index:number){
  const group=new THREE.Group();group.userData.partId=part.id??part.name;group.userData.assembly=assemblyForPart(part);partGroups.set(part.id??part.name,group);internals.add(group);
  const material=part.custom_parameters.placeholder?new THREE.MeshStandardMaterial({color:0xc0a782,metalness:.3,roughness:.55}):silver;
  const sites=motorCount===2?[-track*.30,track*.30]:[0];
  if(part.custom_parameters.reference_only){
   const name=part.name.toLowerCase();
   if(name.includes('bolt'))for(let i=0;i<4;i++){cylinder(group,.045,.04,[-.3+i*.2,.26,0],silver,'y',6);cylinder(group,.018,.28,[-.3+i*.2,.10,0],silver,'y')}
   else if(name.includes('tensioner')){rounded(group,[.65,.06,.1],[0,.12,0],silver);cylinder(group,.13,.10,[.24,.22,0],dark);for(let i=0;i<14;i++)mesh(group,new THREE.TorusGeometry(.04,.009,6,16),silver,[-.24+i*.025,.20,0]).rotation.y=Math.PI/2}
   else rounded(group,[1.0,.10,.38],[0,.25,0],graphite,.04);
  }else if(part.category==='chassis_material'){
   const pvc=part.name.toLowerCase().includes('pvc');cylinder(group,.065,1.8,[0,.22,0],pvc?cream:graphite,'x');
   for(const x of [-.9,.9])cylinder(group,.05,.004,[x,.22,0],dark,'x');
  }else if(part.category==='chassis'){
   for(const z of [-width*.38,width*.38])tube(group,[-length*.48,.44,z],[length*.48,.44,z],.033,graphite);
   for(const x of [-wb/2,-.3,.45,wb/2])tube(group,[x,.44,-width*.38],[x,.44,width*.38],.031,silver);
   for(const x of [-wb/2,wb/2])for(const z of [-width*.38,width*.38])rounded(group,[.17,.012,.16],[x,.48,z],material,.008);
  }else if(part.category==='motor'){
   for(const z of sites){
    cylinder(group,.13,.26,[.30,.67,z],graphite);for(let i=0;i<7;i++)cylinder(group,.135,.009,[.30,.67,z-.10+i*.033],silver);
    cylinder(group,.09,.018,[.30,.67,z+.14],dark);cylinder(group,.026,.16,[.30,.67,z+Math.sign(z||1)*.17],silver);
    rounded(group,[.25,.035,.25],[.30,.53,z],dark,.007);
   }
  }else if(part.category==='battery'){
   rounded(group,[.82,.23,.41],[-.32,.62,0],dark,.065);rounded(group,[.83,.045,.42],[-.32,.49,0],graphite,.014);
   for(let i=0;i<8;i++)rounded(group,[.012,.10,.38],[-.60+i*.08,.665,0],graphite,.004);
   rounded(group,[.20,.006,.17],[-.36,.741,0],paint,.012);cylinder(group,.028,.018,[.06,.64,0],silver,'x');
   rounded(group,[.06,.05,.08],[.13,.57,.10],gold,.009);
  }else if(part.category==='drivetrain'){
   tube(group,[wb/2,.34,-track*.55],[wb/2,.34,track*.55],.035,silver);
   for(const z of [-track*.36,track*.36]){rounded(group,[.16,.12,.11],[wb/2,.32,z],graphite,.012);cylinder(group,.055,.12,[wb/2,.34,z],silver)}
  }else if(part.category==='motor_mounts'){
   for(const z of sites){rounded(group,[.43,.025,.32],[.30,.50,z],silver,.009);for(const x of [.16,.40])for(const dz of [-.09,.09])rounded(group,[.10,.006,.025],[x,.516,z+dz],dark,.008)}
  }else if(part.category==='drive_chain')sites.forEach(z=>chain(group,z));
  else if(part.category==='motor_sprockets')sites.forEach(z=>gear(group,.075,[.30,.67,z],12));
  else if(part.category==='rear_sprockets')sites.forEach(z=>gear(group,.19,[wb/2,.34,z],60));
  else if(part.category==='chain_protection'){
   for(const z of sites){rounded(group,[.93,.055,.14],[.69,.91,z],graphite,.02);rounded(group,[.08,.33,.14],[1.13,.76,z],graphite,.015);cylinder(group,.05,.06,[.60,.38,z],dark)}
  }else if(part.category==='tires'){
   for(const x of [-wb/2,wb/2])for(const z of [-track/2,track/2])wheel(group,x,z);
  }else if(part.category==='brakes'){
   for(const z of [-track*.40,track*.40]){cylinder(group,r*.48,.018,[wb/2,r+.04,z],material);rounded(group,[.10,.13,.07],[wb/2+r*.35,r+.04,z],graphite,.014)}
  }else if(part.category==='suspension'){
   for(const x of [-wb/2,wb/2])for(const z of [-track*.35,track*.35]){
    tube(group,[x,.33,z],[x-.12,.63,z],.020,graphite);for(let i=0;i<8;i++)mesh(group,new THREE.TorusGeometry(.045,.009,6,16),material,[x-.02-i*.012,.36+i*.028,z]).rotation.z=-.32;
   }
  }else if(part.category==='steering'){
   tube(group,[-wb/2,.40,-track*.4],[-wb/2,.40,track*.4],.018,silver);
   rounded(group,[.27,.15,.18],[-wb/2,.58,0],graphite);cylinder(group,.04,.04,[-wb/2,.68,0],gold,'y');
   for(const z of [-track*.4,track*.4]){tube(group,[-wb/2,.40,z],[-wb/2+.14,.40,z],.02,gold);tube(group,[-wb/2,.40,z],[-wb/2,.56,z],.025,silver)}
  }else if(part.category==='throttle_control'){
   rounded(group,[.23,.045,.18],[-.68,.58,.24],graphite);const pedal=rounded(group,[.22,.03,.16],[-.69,.69,.24],dark);pedal.rotation.z=.48;
   for(let i=0;i<4;i++){const grip=rounded(group,[.018,.008,.14],[-.76+i*.045,.685+(i-1)*.02,.24],silver,.003);grip.rotation.z=.48}
  }else if(part.category==='embedded_controllers'){
   board(group,[-.02,.82,-.2]);if((part.custom_parameters.installed_quantity??1)>1)board(group,[-.02,.82,.2]);
  }else if(part.category==='inverter'){
   rounded(group,[.45,.06,.36],[.46,.86,0],graphite);rounded(group,[.38,.025,.30],[.46,.91,0],violet);
   for(let i=0;i<4;i++){rounded(group,[.055,.07,.20],[.32+i*.09,.96,0],silver,.005);cylinder(group,.026,.08,[.32+i*.09,.97,.13],dark,'y')}
  }else if(part.category==='cooling'){
   rounded(group,[.29,.035,.29],[.74,.84,-.28],graphite,.02);cylinder(group,.12,.04,[.74,.87,-.28],dark,'y');
   for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const blade=rounded(group,[.10,.012,.042],[.74+Math.cos(a)*.06,.90,-.28+Math.sin(a)*.06],silver,.014);blade.rotation.y=-a+.4}
  }else if(part.category==='sensors'){
   for(const entry of sensorEntries([part]))for(const site of entry.mounts){const object=createSensorObject(entry.kind,site.site);object.position.set(...mountPosition(site.site,dims));group.add(object)}
  }else if(part.category==='vision'){
   rounded(group,[.10,.08,.14],[-1.12,.88,0],pcb);cylinder(group,.028,.055,[-1.18,.88,0],dark,'x');cylinder(group,.019,.06,[-1.20,.88,0],glass,'x');
  }else if(part.category==='safety_controls'){
   rounded(group,[.10,.06,.10],[-.23,.81,-.33],graphite);cylinder(group,.035,.045,[-.23,.87,-.33],new THREE.MeshStandardMaterial({color:0xc44e3f}),'y');
  }else{
   const i=index%4;rounded(group,[.21,.08,.15],[-.17+i*.16,.72,-.32],part.category==='signal_interface'?pcb:material,.012);
   for(let j=0;j<4;j++)rounded(group,[.018,.02,.025],[-.24+i*.16+j*.04,.77,-.23],gold,.003);
  }
  group.visible=false;return group;
 }
 allParts.forEach(buildPart);

 let view:SceneView={assembly:null,part:null,exploded:false},animation=0,lastTime=performance.now(),transition=false,highlight:THREE.Object3D[]=[];
 const destination=new THREE.Vector3(),lookAt=new THREE.Vector3(),offsets=new Map<THREE.Group,THREE.Vector3>();
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function visibleBox(){
  const bounds=new THREE.Box3();
  if(!view.assembly)bounds.setFromObject(exterior);
  else for(const group of partGroups.values())if(group.visible)bounds.union(new THREE.Box3().setFromObject(group));
  if(bounds.isEmpty())bounds.set(new THREE.Vector3(-.5,.1,-.5),new THREE.Vector3(.5,.9,.5));
  return bounds;
 }
 function fit(immediate=false){
  scene.updateMatrixWorld(true);const bounds=visibleBox(),center=bounds.getCenter(new THREE.Vector3());
  const direction=new THREE.Vector3(-1,.70,1.22).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
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
 function manual(){transition=false;leave()}
 canvas.addEventListener('pointermove',hover);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointerleave',leave);controls.addEventListener('start',manual);
 const resize=()=>{camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);fit(true)};
 const observer=new ResizeObserver(resize);observer.observe(host);resize();fit(true);
 function draw(now:number){
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(transition){const t=1-Math.exp(-dt*8);camera.position.lerp(destination,t);controls.target.lerp(lookAt,t);if(camera.position.distanceToSquared(destination)<.00001)transition=false;}
  const speed=callbacks.speed();if(speed)wheels.forEach(w=>w.rotateZ(-speed/r*dt));
  controls.update();renderer.render(scene,camera);animation=requestAnimationFrame(draw);
 }
 animation=requestAnimationFrame(draw);
 return {setView,fit:()=>fit(),dispose:()=>{
  cancelAnimationFrame(animation);observer.disconnect();canvas.removeEventListener('pointermove',hover);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointerleave',leave);controls.removeEventListener('start',manual);controls.dispose();
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m))}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();canvas.remove();
 }};
}
