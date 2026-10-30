import {useState} from 'react';
import type {Part,Vehicle} from '../types';
import {fmt} from '../api';

export function ProjectDetails({vehicle,parts}:{vehicle:Vehicle;parts:Part[]}){
 const [tab,setTab]=useState('assembly');
 const meta=vehicle.custom_parameters;
 if(!meta?.document_project)return null;
 const installed=parts.filter(p=>vehicle.component_ids.includes(p.id!));
 const procurement=parts.filter(p=>(meta.procurement_component_ids as string[]).includes(p.id!));
 const list=tab==='assembly'?installed:procurement;
 const budget=procurement.reduce((sum,p)=>sum+(p.price??0)*(p.custom_parameters.price_scope==='per_stock_length'?(p.custom_parameters.purchase_quantity??0):1),0);
 return <section className="panel project-details">
  <div className="panel-title">Document-sourced vehicle draft<span>SPECIFICATIONS INCOMPLETE</span></div>
  <div className="padded">
   <div className="project-status"><div><span className="badge amber">PROVISIONAL / NO PERFORMANCE RESULTS</span><h3>{meta.topology}</h3><p>The parts below come from your supplied documents and linked products. Sensor locations and quantities are estimates. Missing systems are placeholders; their dimensions, weights and ratings remain unknown. The hypothetical demo is a separate vehicle.</p></div><div className="project-budget"><span>Known planning allowances</span><strong>{meta.budget_is_estimate?'~':''}${fmt(budget,2)}{meta.budget_is_lower_bound?'+':''}</strong><small>USD · partial budget only</small></div></div>
   <p className="muted">Group 4 purchase lines: $141, including spares and off-vehicle equipment. {meta.motor_selection_note??'Original single-motor belt option: approximately $192 before Group 4.'} Listed prices have not been re-quoted.</p>
   {meta.architecture_note&&<p>{meta.architecture_note}</p>}
   {meta.drive_hardware_note&&<p>{meta.drive_hardware_note}</p>}
   {meta.regenerative_braking_note&&<p><b>Regenerative braking: </b>{meta.regenerative_braking_note}</p>}
   {meta.chassis_material_component_ids&&<p className="muted">Chassis material quotes are per stock length. Required quantities are unknown and excluded from the subtotal.</p>}
   <div className="test-types project-tabs"><button className={tab==='assembly'?'active':''} onClick={()=>setTab('assembly')}>Provisional assembly ({installed.length})</button><button className={tab==='procurement'?'active':''} onClick={()=>setTab('procurement')}>Purchase planning ({procurement.length})</button></div>
  </div>
  <div className="table-scroll"><table><thead><tr><th>Part / system</th><th>{tab==='assembly'?'Installed quantity':'Purchase line'}</th><th>Recorded information</th><th>{tab==='assembly'?'Installed mass':'Allowance / USD'}</th><th>Status</th></tr></thead><tbody>{list.map(p=>{
   const cp=p.custom_parameters,quantity=cp.installed_quantity;
   const facts=Object.entries(p.specs).filter(([key])=>key.startsWith('listed_')||['drive_type','driven_wheels','differential','steering_geometry','control_mode'].includes(key)).map(([key,value])=>`${key.replace('listed_','').replaceAll('_',' ')}: ${Array.isArray(value)?value.join('–'):String(value)} ${['text','boolean'].includes(p.units[key])?'':p.units[key]??''}`);
   return <tr key={p.id}><td>{p.name}<small>{p.category} {p.model&&' / '+p.model}</small></td><td>{tab==='assembly'?(quantity==null?'Not established':`${quantity}${cp.sensor_type?' (estimated)':''}`):(cp.user_fabricated?'Team fabrication':cp.price_scope==='per_stock_length'?(cp.purchase_quantity==null?'Quantity unknown':`${cp.purchase_quantity} stock lengths`):cp.package_units?`1 × ${cp.package_units}-unit package`:'1 planning line')}<small>{cp.installation_scope?.replaceAll('_',' ')??''}</small>{tab==='procurement'&&cp.price_scope==='per_stock_length'&&<small>{cp.price_basis}</small>}</td><td>{facts.length?facts.join(' · '):'Specifications pending'}{cp.sensor_mounts&&<small>Estimated mounts: {cp.sensor_mounts.map((m:any)=>m.label).join('; ')}</small>}{p.datasheet&&<small><a href={p.datasheet} target="_blank" rel="noreferrer">Supplied product/search reference ↗</a></small>}<small>{cp.source_references?.map((s:any)=>`${s.document} / ${s.location}`).join('; ')}</small></td><td>{tab==='assembly'?(p.mass_kg==null?'Unknown':`${fmt(p.mass_kg)} kg`):p.price==null?'Unknown':`${cp.price_qualifier==='estimated_lower_bound'?'~':''}$${fmt(p.price,2)}${cp.price_qualifier==='estimated_lower_bound'?'+':''}`}</td><td><span className="badge amber">{cp.part_status??'Unverified'}</span></td></tr>
  })}</tbody></table></div>
  <div className="padded"><h3>Still needed to complete this car</h3><ul>{(meta.unresolved_systems as string[]).map(s=><li key={s}>{s}</li>)}</ul><p className="muted">Budget excludes: {(meta.budget_excludes as string[]).join('; ')}. {meta.budget_note}</p></div>
 </section>
}
