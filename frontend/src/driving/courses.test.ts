import {describe,expect,it} from 'vitest';
import {COURSES,coursePoints,roadStrip} from './courses';
import type {EnvironmentId} from './courses';

describe('Driving courses',()=>{
  it('keeps every navigable route inside the physical test-ground barriers',()=>{
    expect(Object.keys(COURSES)).toHaveLength(7);
    for(const id of Object.keys(COURSES) as EnvironmentId[]){
      const points=coursePoints(id);
      expect(points.length).toBeGreaterThan(1);
      for(const [x,y,z] of points){
        expect([x,y,z].every(Number.isFinite)).toBe(true);
        expect(Math.abs(x)+COURSES[id].width/2).toBeLessThan(180);
        expect(z-COURSES[id].width/2).toBeGreaterThan(-110);
        expect(z+COURSES[id].width/2).toBeLessThan(360);
      }
    }
  });
  it('closes both sides of the club circuit without a seam or missing collider triangles',()=>{
    const road=roadStrip('circuit');
    for(const edge of road.edges){
      expect(Math.hypot(...edge[0].map((n,i)=>n-edge.at(-1)![i]))).toBeLessThan(.001);
    }
    expect(road.paved.length+road.gravel.length).toBe((road.centers.length-1)*6);
    expect(road.gravel.length).toBe(0);
  });
  it('gives each road triangle an upward-facing, nondegenerate contact surface',()=>{
    for(const id of ['circuit','rally'] as const){
      const road=roadStrip(id);
      for(const indices of [road.paved,road.gravel])for(let i=0;i<indices.length;i+=3){
        const [a,b,c]=[indices[i],indices[i+1],indices[i+2]].map(index=>index*3);
        const abx=road.vertices[b]-road.vertices[a],abz=road.vertices[b+2]-road.vertices[a+2];
        const acx=road.vertices[c]-road.vertices[a],acz=road.vertices[c+2]-road.vertices[a+2];
        expect(abz*acx-abx*acz).toBeGreaterThan(.001);
      }
    }
  });
  it('partitions the rally road into real paved and gravel contact triangles',()=>{
    const road=roadStrip('rally'),all=[...road.paved,...road.gravel];
    expect(road.paved.length).toBeGreaterThan(0);expect(road.gravel.length).toBeGreaterThan(road.paved.length);
    expect(all).toHaveLength((road.centers.length-1)*6);
    expect(all.every(index=>index<road.vertices.length/3)).toBe(true);
    const triangles=new Set<string>();
    for(let i=0;i<all.length;i+=3)triangles.add(all.slice(i,i+3).join(','));
    expect(triangles.size).toBe(all.length/3);
  });
  it('keeps rally elevation changes gentle and starts at the vehicle spawn',()=>{
    const road=roadStrip('rally');expect(road.centers[0].toArray()).toEqual([0,0,0]);
    expect(Math.max(...road.centers.map(p=>p.y))).toBeGreaterThan(.6);
    for(let i=1;i<road.centers.length;i++){
      const a=road.centers[i-1],b=road.centers[i];
      expect(Math.abs(b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z)).toBeLessThan(.06);
    }
  });
});
