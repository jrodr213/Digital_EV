import {describe,expect,it} from 'vitest';
import type {Result} from '../types';
import {driveFrame,MPS_PER_MPH,playbackTime,prepareDriveTrace,sameDriveConditions} from './playbackMotion';

function result(samples:Record<string,number>[],diameter:number|undefined=1):Result{
 return {id:'run',name:'Test drive',created_at:'2026-11-01T12:00:00Z',summary:{},analytical:{},warnings:[],assumptions:[],samples,
  assembly:{errors:[],warnings:[],mass_kg:100,specs:{drivetrain:diameter===undefined?{}:{wheel_diameter_m:diameter}}},request:{test:'cycle',cycle:'example'},vehicle_snapshot:{id:'car',name:'Car',component_ids:[],payload_kg:75,auxiliary_w:50,notes:''}};
}
const at=(time:number,speed:number)=>({time_s:time,speed_mph:speed/MPS_PER_MPH,target_mph:100,soc:.9-time*.001});

describe('saved-drive kinematics',()=>{
 it('converts achieved speed to metres using irregular intervals, never requested speed',()=>{
  const trace=prepareDriveTrace(result([at(0,0),at(2,4),at(5,4)]));
  expect(trace.totalDistance).toBeCloseTo(16);
  expect(driveFrame(trace,1).distance).toBeCloseTo(1);
  expect(driveFrame(trace,1).speedMps).toBeCloseTo(2);
  expect(driveFrame(trace,3).distance).toBeCloseTo(8);
  expect(driveFrame(trace,3).wheelAngle).toBeCloseTo(16);
 });
 it('uses recorded engine distance when present instead of substituting a new trajectory',()=>{
  const trace=prepareDriveTrace(result([{...at(10,4),distance_m:100},{...at(12,4),distance_m:109}]));
  expect(trace.nativeDistance).toBe(true);expect(trace.duration).toBe(2);expect(trace.totalDistance).toBe(9);
  expect(driveFrame(trace,1).distance).toBe(4.5);
  expect(driveFrame(trace,2).wheelAngle).toBe(18);
 });
 it('returns identical positions and wheel angles after arbitrary scrubbing and frame schedules',()=>{
  const trace=prepareDriveTrace(result([at(0,0),at(4,8),at(8,0)]));
  const expected=driveFrame(trace,3.25);
  [7,0,1.4,8,2,3.25].forEach(time=>driveFrame(trace,time));
  expect(driveFrame(trace,3.25)).toEqual(expected);
  const fast=playbackTime(0,.325,10,8),slow=playbackTime(0,13,.25,8);
  expect(driveFrame(trace,fast)).toEqual(driveFrame(trace,slow));
 });
 it('keeps runs at the same simulation second without normalizing their distance or duration',()=>{
  const fast=prepareDriveTrace(result([at(0,10),at(10,10)]));
  const slow=prepareDriveTrace(result([at(0,5),at(20,5)]));
  expect(driveFrame(fast,5).distance).toBeCloseTo(50);
  expect(driveFrame(slow,5).distance).toBeCloseTo(25);
  expect(driveFrame(fast,15).distance).toBeCloseTo(100);
  expect(driveFrame(fast,15).ended).toBe(true);
  expect(driveFrame(slow,15).distance).toBeCloseTo(75);
 });
 it('holds final recordings without extrapolation and handles stopped or single-sample traces',()=>{
  const trace=prepareDriveTrace(result([at(0,0),at(2,0)]));
  expect(driveFrame(trace,-3).distance).toBe(0);expect(driveFrame(trace,99).distance).toBe(0);
  expect(driveFrame(prepareDriveTrace(result([at(0,0)])),1).ended).toBe(true);
 });
 it('never invents a physical wheel diameter',()=>{
  const run=result([at(0,1),at(2,1)]);run.assembly.specs!.drivetrain={};
  expect(driveFrame(prepareDriveTrace(run),1).wheelAngle).toBeNull();
 });
 it('rejects corrupt traces instead of hiding invalid samples',()=>{
  for(const rows of [[],[at(0,0),at(0,1)],[at(0,0),at(1,-1)],[at(0,0),at(1,NaN)],
   [{...at(0,0),distance_m:0},at(1,1)],[{...at(0,0),distance_m:1},{...at(1,1),distance_m:0}]]){
   expect(()=>prepareDriveTrace(result(rows))).toThrow();
  }
 });
 it('identifies different conditions and saved target schedules even under the same cycle name',()=>{
  const a=result([at(0,0),at(2,4)]),b=result([at(0,1),at(2,3)]);
  expect(sameDriveConditions(a,b)).toBe(true);
  b.samples[1].target_mph=20;expect(sameDriveConditions(a,b)).toBe(false);
  b.samples[1].target_mph=100;b.request.grade=.1;expect(sameDriveConditions(a,b)).toBe(false);
 });
});
