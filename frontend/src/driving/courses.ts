import {CatmullRomCurve3,Vector3} from 'three';

export type CoursePoint=[number,number,number];
export type CourseDefinition={name:string;description:string;tip:string;points:CoursePoint[];closed:boolean;width:number;smooth:boolean;branches?:CoursePoint[][]};

const oval:CoursePoint[]=[ [0,0,0],[0,0,250],
  ...Array.from({length:24},(_,i):CoursePoint=>{const a=Math.PI-(i+1)*Math.PI/24;return [35+35*Math.cos(a),0,250+35*Math.sin(a)];}),
  [70,0,0],...Array.from({length:24},(_,i):CoursePoint=>{const a=-(i+1)*Math.PI/24;return [35+35*Math.cos(a),0,35*Math.sin(a)];})
];

export const COURSES={
  track:{name:'Paved test track',description:'A 250 m straight, broad turns and a marked braking zone.',tip:'Follow the loop; the return straight is on the other side.',points:oval,closed:true,width:12,smooth:false},
  hills:{name:'Hill test',description:'Three climbing lanes with 5%, 10% and 20% gradients.',tip:'The center lane is 10%. Use the left/right lanes for the other inclines.',points:[[0,0,0],[0,0,20],[0,4.5,65],[0,4.5,80],[0,0,125],[0,0,150]],closed:false,width:12,smooth:false,branches:[[[-18,0,0],[-18,0,150]],[[18,0,0],[18,0,150]]]},
  terrain:{name:'Uneven terrain',description:'Suspension bumps, a gravel section and small obstacles.',tip:'Keep the wheels on the marked lane; gravel begins at 40 m.',points:[[0,0,0],[0,0,160]],closed:false,width:14,smooth:false},
  circuit:{name:'Club circuit',description:'A complete paved lap with S-bends and tighter corners.',tip:'Follow the white road edges around the full circuit.',points:[[0,0,0],[0,0,20],[-20,0,40],[-24,0,70],[0,0,88],[24,0,70],[48,0,88],[68,0,60],[50,0,38],[54,0,12],[30,0,-18],[20,0,-22],[6,0,-15]],closed:true,width:8,smooth:true},
  city:{name:'City streets',description:'Intersections, city blocks, crosswalks and parking bays.',tip:'Explore the street grid or follow the side spur into the parking bays.',points:[[0,0,0],[0,0,120],[80,0,120],[80,0,0]],closed:true,width:10,smooth:false,branches:[[[40,0,0],[40,0,120]],[[0,0,40],[120,0,40]],[[0,0,80],[80,0,80]],[[110,0,18],[110,0,62]]]},
  slalom:{name:'Cone slalom',description:'Six offset gates followed by a braking and turnaround box.',tip:'Pass between each pair of numbered cones, then stop in the finish box.',points:[[0,0,0],[-4,0,18],[4,0,34],[-4,0,50],[4,0,66],[-4,0,82],[4,0,98],[0,0,116]],closed:false,width:24,smooth:true},
  rally:{name:'Gravel rally',description:'A winding route with gentle rises and changing road grip.',tip:'Amber sections are gravel. Brake before bends; turn around at the finish.',points:[[0,0,0],[0,0,18],[-18,.3,40],[-36,.7,70],[-10,.7,92],[20,.4,120],[0,.15,150],[26,0,178],[52,0,180]],closed:false,width:10,smooth:true},
} satisfies Record<string,CourseDefinition>;

export type EnvironmentId=keyof typeof COURSES;
export const ENVIRONMENTS=Object.fromEntries(Object.entries(COURSES).map(([id,course])=>[id,course.name])) as Record<EnvironmentId,string>;

export function coursePoints(id:EnvironmentId,samples=240):CoursePoint[]{
  const course=COURSES[id];
  if(!course.smooth)return course.closed?[...course.points,course.points[0]]:course.points;
  return new CatmullRomCurve3(course.points.map(p=>new Vector3(...p)),course.closed,'centripetal').getSpacedPoints(samples).map(p=>p.toArray() as CoursePoint);
}

// One continuous strip provides the visible road and the exact triangle data
// passed to Rapier. Separate surface runs share vertices, so grip changes don't
// introduce gaps, steps or a decorative-only road surface.
export function roadStrip(id:'circuit'|'rally',samples=320){
  const course=COURSES[id];
  const curve=new CatmullRomCurve3(course.points.map(p=>new Vector3(...p)),course.closed,'centripetal');
  const centers=curve.getSpacedPoints(samples),positions:number[]=[],paved:number[]=[],gravel:number[]=[];
  const edges:[CoursePoint[],CoursePoint[]]=[[],[]];
  centers.forEach((center,i)=>{
    const tangent=curve.getTangentAt(course.closed&&i===samples?0:i/samples),side=new Vector3(tangent.z,0,-tangent.x).normalize();
    for(const sign of [1,-1]){
      positions.push(center.x+side.x*sign*course.width/2,center.y,center.z+side.z*sign*course.width/2);
      edges[sign===1?0:1].push([center.x+side.x*sign*(course.width/2-.18),center.y+.018,center.z+side.z*sign*(course.width/2-.18)]);
    }
    if(i<samples){
      const a=i*2,b=a+2,t=(i+.5)/samples;
      const surface=id==='rally'&&((t>.1&&t<.68)||t>.82)?gravel:paved;
      surface.push(a,a+1,b,a+1,b+1,b);
    }
  });
  return {vertices:new Float32Array(positions),paved:new Uint32Array(paved),gravel:new Uint32Array(gravel),centers,edges,length:curve.getLength()};
}
