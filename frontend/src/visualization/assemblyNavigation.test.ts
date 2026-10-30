import {describe,it,expect} from 'vitest';
import type {Part} from '../types';
import architecture from '../../../data/components/team-architecture.json';
import hardware from '../../../data/components/team-drive-hardware.json';
import battery from '../../../data/components/team-battery.json';
import sensors from '../../../data/components/team-sensors.json';
import {assemblyDefinitions,assemblyParts,partChildren,partLabel,visualParts} from './assemblyNavigation';

const parts=JSON.parse(JSON.stringify([...architecture,...hardware,...battery,...sensors])) as Part[];
describe('assembly exploration',()=>{
 it('keeps every saved part discoverable in exactly one top-level assembly',()=>{
  const custom={...parts[0],id:'custom-extra',category:'custom-hardware'};
  const input=[...parts,custom];
  const grouped=assemblyDefinitions.flatMap(a=>assemblyParts(a.id,input));
  expect(grouped).toHaveLength(input.length);
  expect(new Set(grouped.map(p=>p.id)).size).toBe(input.length);
  expect(assemblyParts('electronics',input)).toContain(custom);
 });
 it('exposes selected material references without turning them into installed parts',()=>{
  const frame=parts.find(p=>p.id==='team-chassis-pipe-frame')!;
  const material=parts.find(p=>p.id==='team-material-pvc-10ft')!;
  const before=JSON.stringify(frame);
  expect(partChildren(frame,[material])).toEqual([material]);
  expect(visualParts([frame],[material])).toEqual([frame,material]);
  expect(JSON.stringify(frame)).toBe(before);
 });
 it('lets a guard bundle open its individual estimated items without recursive children or invented mass',()=>{
  const bundle=parts.find(p=>p.id==='team-chain-guard-adjustment')!;
  const before=JSON.stringify(bundle),children=partChildren(bundle,parts);
  expect(children).toHaveLength(3);
  expect(new Set(children.map(p=>p.id)).size).toBe(3);
  expect(new Set(children.map(partLabel)).size).toBe(3);
  for(const child of children){expect(child.mass_kg).toBeNull();expect(child.custom_parameters.reference_only).toBe(true);expect(partChildren(child,parts)).toEqual([])}
  expect(JSON.stringify(bundle)).toBe(before);
 });
});
