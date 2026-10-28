import {describe,it,expect} from 'vitest';
import type {Part} from '../types';
import sensorData from '../../../data/components/team-sensors.json';
import {sensorEntries,mountPosition} from './sensorLayout';
import {describePart} from './partDescription';

const dimensions={length:3.2,width:1.5,wb:2.1,track:1.25,r:.28};
const sensors:Part[]=sensorData.map(sensor=>({...sensor,units:Object.fromEntries(
 Object.entries(sensor.units).filter((entry):entry is [string,string]=>typeof entry[1]==='string')
)}));

describe('estimated sensor layout',()=>{
 it('keeps front distance sensors ahead of the car and encoders at opposite rear hubs',()=>{
  const entries=sensorEntries(sensors);
  expect(entries).toHaveLength(8);
  for(const site of ['front_left','front_right','front_center','bumper_contact'] as const){
   expect(mountPosition(site,dimensions)[0]).toBeLessThan(-dimensions.length/2);
  }
  const left=mountPosition('rear_left_hub',dimensions),right=mountPosition('rear_right_hub',dimensions);
  expect(left[0]).toBe(dimensions.wb/2);expect(right[0]).toBe(dimensions.wb/2);
  expect(left[2]).toBeGreaterThan(0);expect(right[2]).toBeLessThan(0);
  expect(mountPosition('front_center',{...dimensions,length:4})[0]).toBeLessThan(-2);
 });
 it('tolerates unrelated or malformed custom component metadata',()=>{
  const part=sensors[0];
  expect(sensorEntries([{...part,custom_parameters:{}},{...part,custom_parameters:{sensor_type:'infrared',sensor_mounts:[null,{site:'invalid',label:'Invalid'}]}}])).toEqual([]);
 });
 it('shows sensor purpose and estimated location while keeping unknown mass unavailable',()=>{
  const info=describePart(sensors[0]);
  expect(info.status).toContain('estimated mounting');
  expect(info.role).toContain('front corners');
  expect(info.facts.some(f=>f.label==='Estimated mounts'&&f.value.includes('Front left'))).toBe(true);
  expect(info.facts.find(f=>f.label==='Installed mass')?.value).toBe('Not supplied');
 });
});
