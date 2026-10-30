import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base='http://127.0.0.1:8000';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const snapshot=async()=>JSON.stringify(await Promise.all(['components','vehicles'].map(async path=>(await page.request.get(`${base}/api/${path}`)).json())));
await mkdir('../docs/screenshots',{recursive:true});
try{
 const before=await snapshot();
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByLabel('Active design').selectOption('team-ev-belt');
 const explorer=page.getByRole('region',{name:'Interactive vehicle explorer'});
 await explorer.locator('canvas').waitFor();
 assert.equal(await explorer.getAttribute('data-view'),'full','Home must start at the finished full car');
 await page.locator('nav').getByRole('button',{name:'3D Vehicle Viewer',exact:true}).click();
 await explorer.locator('canvas').waitFor();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await explorer.locator('.explorer-failure').count(),0,'WebGL rendering failed');
 assert.equal(await explorer.getAttribute('data-view'),'full');
 assert.equal(await explorer.locator('.explorer-assembly-grid>button').count(),7);
 await explorer.screenshot({path:'../docs/screenshots/vehicle-finished-concept.png'});

 // Pick an actual finished-body surface with the raycaster.
 async function pickMesh(){
  const canvas=explorer.locator('canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();assert.ok(box);
  for(const fy of [.48,.56,.40,.64,.32,.70])for(const fx of [.5,.42,.58,.34,.66,.26,.74]){
   await page.mouse.move(box.x+box.width*fx,box.y+box.height*fy);
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   if(await explorer.getByRole('tooltip').count()){
    await page.mouse.click(box.x+box.width*fx,box.y+box.height*fy);return true;
   }
  }return false;
 }
 assert.ok(await pickMesh(),'No finished car surface could be opened');
 assert.equal(await explorer.getAttribute('data-view'),'assembly');
 await explorer.getByRole('button',{name:'Back to full car',exact:true}).click();
 await explorer.getByRole('button',{name:'Explore Powertrain',exact:true}).focus();await page.keyboard.press('Enter');
 assert.equal(await explorer.getAttribute('data-view'),'assembly');
 assert.ok(await pickMesh(),'No actual assembly part could be picked');
 assert.equal(await explorer.getAttribute('data-view'),'component');
 await page.keyboard.press('Escape');assert.equal(await explorer.getAttribute('data-view'),'assembly');
 const exploded=explorer.getByRole('button',{name:'Exploded',exact:true});
 await exploded.click();assert.equal(await exploded.getAttribute('aria-pressed'),'false');
 await exploded.click();assert.equal(await exploded.getAttribute('aria-pressed'),'true');
 await explorer.screenshot({path:'../docs/screenshots/vehicle-powertrain-explorer.png'});
 await explorer.getByRole('button',{name:'Full car',exact:true}).click();

 const library=await (await page.request.get(`${base}/api/components`)).json();
 const assemblyNames=['Powertrain','Battery & power','Electronics','Body & frame','Steering & pedals','Wheels & brakes','Sensors & vision'];
 let inspected=0;
 for(const name of assemblyNames){
  await explorer.getByRole('button',{name:`Explore ${name}`,exact:true}).click();
  const labels=await explorer.locator('.explorer-component-list>button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label')));
  assert.ok(labels.length>0);
  for(const label of labels){
   await explorer.getByRole('button',{name:label,exact:true}).click();
   assert.equal(await explorer.getAttribute('data-view'),'component');
   assert.equal(await explorer.locator('.explorer-sidebar').evaluate(element=>element.scrollTop),0,'Details must open at the top');
   const fullName=await explorer.locator('.explorer-component-name').innerText();
   const part=library.find(part=>part.name===fullName);assert.ok(part,fullName);
   if(part.mass_kg==null)assert.equal(await explorer.locator('.explorer-part-facts>div').filter({hasText:'Installed mass'}).locator('dd').innerText(),'Unknown');
   if(part.datasheet)assert.equal(await explorer.getByRole('link',{name:'Open supplied product reference'}).getAttribute('href'),part.datasheet);
   inspected++;
   await explorer.getByRole('button',{name:`Back to ${name}`,exact:true}).click();
  }
  await explorer.getByRole('button',{name:'Full car',exact:true}).click();
 }
 assert.equal(inspected,29,'All saved installed component groups must remain discoverable');

 await explorer.getByRole('button',{name:'Explore Body & frame',exact:true}).click();
 await explorer.getByRole('button',{name:'Inspect Fabricated pipe frame',exact:true}).click();
 assert.equal(await explorer.locator('.explorer-child-parts>button').count(),2);
 await explorer.locator('.explorer-child-parts>button').filter({hasText:'PVC'}).click();
 assert.match(await explorer.locator('.explorer-component-name').innerText(),/PVC/);
 assert.match(await explorer.getByRole('link',{name:'Open supplied product reference'}).getAttribute('href'),/319692959/);
 await explorer.getByRole('button',{name:'Back to Fabricated pipe frame',exact:true}).click();
 assert.equal(await explorer.locator('.explorer-child-parts>button').count(),2);
 await explorer.getByRole('button',{name:'Full car',exact:true}).click();
 await explorer.getByRole('button',{name:'Explore Powertrain',exact:true}).click();
 await explorer.getByRole('button',{name:'Inspect Guards & adjustment',exact:true}).click();
 assert.equal(await explorer.locator('.explorer-child-parts>button').count(),3);
 await explorer.locator('.explorer-child-parts>button').filter({hasText:'tensioner'}).click();
 assert.match(await explorer.locator('.explorer-component-name').innerText(),/tensioner/i);
 // Selecting another design from a nested reference must reset cleanly.
 await page.getByLabel('Visualized vehicle').selectOption('demo-student-ev');
 assert.equal(await explorer.getAttribute('data-view'),'full');
 await page.getByLabel('Visualized vehicle').selectOption('team-ev-belt');
 assert.equal(await explorer.getAttribute('data-view'),'full');
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await explorer.getAttribute('data-view'),'full');
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile horizontal overflow');
 await explorer.screenshot({path:'../docs/screenshots/vehicle-explorer-mobile.png'});
 await explorer.getByRole('button',{name:'Explore Battery & power',exact:true}).click();
 await explorer.getByRole('button',{name:'Inspect Battery pack',exact:true}).click();
 await explorer.getByRole('button',{name:'Back to Battery & power',exact:true}).click();
 await explorer.getByRole('button',{name:'Back to full car',exact:true}).click();
 assert.equal(await explorer.getAttribute('data-view'),'full');
 assert.deepEqual(errors,[]);
 assert.equal(await snapshot(),before,'Exploring must never alter saved components or vehicles');
 console.log('PASS: finished full-car default, real mesh drill-down, all seven assemblies / 29 component groups, original product links and unknown values, nested materials and bundle items, Back/breadcrumb/Escape navigation, exploded toggle, vehicle switch/reset, mobile and unchanged saved data.');
}catch(error){await page.screenshot({path:'../docs/screenshots/vehicle-explorer-failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();}
