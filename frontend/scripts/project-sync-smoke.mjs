// Verify an actual JSON-only repository change, including a newly added dataset.
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const base=process.env.EV_BASE_URL??'http://127.0.0.1:8000';
const source=join(root,'data/components/team-direct-drive.json');
const extra=join(root,`data/components/team-preview-sync-${process.pid}.json`);
const id=`team-preview-sync-${process.pid}`;
const marker=`preview_sync_${process.pid}`;
const original=await readFile(source);
const browser=await chromium.launch({channel:process.env.EV_BROWSER??'chrome',headless:true});
const page=await browser.newPage();
const get=async path=>{
 const response=await page.request.get(`${base}/api/${path}`,{timeout:2000});
 assert.ok(response.ok());return response.json();
};
const snapshot=async()=>Object.fromEntries(await Promise.all(['components','vehicles','results'].map(async kind=>[
 kind,Object.fromEntries((await get(kind)).map(record=>[record.id,record])),
])));
async function waitFor(check){
 for(let attempt=0;attempt<100;attempt++){
  try{if(await check())return}catch{/* API reconnects during source reload. */}
  await delay(200);
 }
 assert.fail('Repository data update did not reach the live preview');
}
let before;
try{
 assert.equal((await get('health')).preview_mode,'live');
 before=await snapshot();
 assert.ok(!before.components[id]);
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Home Dashboard',exact:true}).waitFor();
 const timeOrigin=await page.evaluate(()=>performance.timeOrigin);
 const updated=JSON.parse(original.toString('utf8'));
 updated[0].custom_parameters[marker]='pulled JSON update';
 await writeFile(source,JSON.stringify(updated,null,2)+'\n');
 await writeFile(extra,JSON.stringify([{id,name:'Temporary repository-sync check',category:'auxiliary',
  hypothetical:true,custom_parameters:{document_project:'team-parts-2026-10-22'}}])+'\n');
 await waitFor(async()=>{
  const parts=await get('components');
  return parts.some(part=>part.id===id)&&parts.some(part=>part.id==='team-drive-wheel-direct'&&part.custom_parameters[marker]==='pulled JSON update');
 });
 await page.waitForFunction(previous=>performance.timeOrigin>previous,timeOrigin);
 const after=await snapshot();
 delete after.components[id];
 delete after.components['team-drive-wheel-direct'].custom_parameters[marker];
 assert.deepEqual(after,before,'Only the intended repository fields may change');
 console.log('PASS: JSON-only car data edits and new team datasets sync automatically; the open browser refreshes; saved measurements and simulation history are unchanged.');
}finally{
 try{
  await writeFile(source,original);
  await unlink(extra).catch(error=>{if(error.code!=='ENOENT')throw error});
  await waitFor(async()=>!(await get('components')).find(part=>part.id==='team-drive-wheel-direct')?.custom_parameters[marker]);
  if(before&&!before.components[id]){
   const response=await page.request.delete(`${base}/api/components/${id}`);
   assert.ok(response.ok());
   assert.deepEqual(await snapshot(),before,'Smoke check cleanup must restore all saved records');
  }
 }finally{await browser.close()}
}
