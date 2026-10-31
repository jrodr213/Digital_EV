// Run against npm run dev. Temporary probes verify real frontend/backend reloads.
import assert from 'node:assert/strict';
import {writeFile,unlink} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const base=process.env.EV_BASE_URL??'http://127.0.0.1:8000';
const name=`__preview_probe_${process.pid}`;
const css=join(root,'frontend/src',`${name}.css`);
const python=join(root,'backend',`${name}.py`);
const browser=await chromium.launch({channel:process.env.EV_BROWSER??'chrome',headless:true});
const page=await browser.newPage();
page.setDefaultTimeout(30000);
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function waitForNewWorker(previous){
 for(let attempt=0;attempt<100;attempt++){
  try{
   const response=await page.request.get(`${base}/api/health`,{timeout:1500});
   if(response.ok()){
    const current=await response.json();
    if(current.process_id!==previous&&current.preview_mode==='live')return current.process_id;
   }
  }catch{/* A short reconnect is expected while the Python worker restarts. */}
  await delay(200);
 }
 assert.fail('A Python edit must reload the API worker');
}
try{
 const health=await (await page.request.get(`${base}/api/health`)).json();
 assert.equal(health.preview_mode,'live');
 const response=await page.goto(base,{waitUntil:'domcontentloaded'});
 assert.match(response.headers()['cache-control'],/no-store/);
 assert.ok((await response.text()).includes('/@vite/client'));
 await page.locator('nav').getByRole('button',{name:'Simulation Lab',exact:true}).click();
 await page.getByRole('checkbox',{name:/Demo mode/}).check();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Run demo simulation'&&!button.disabled));

 await writeFile(css,':root { --ev-preview-check: before; }\n');
 await page.evaluate(url=>import(url),`/src/${name}.css`);
 await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--ev-preview-check').trim()==='before');
 await writeFile(css,':root { --ev-preview-check: after; }\n');
 await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--ev-preview-check').trim()==='after');
 assert.equal(await page.getByRole('checkbox',{name:/Demo mode/}).isChecked(),true,'HMR preserves the open test');

 let timeOrigin=await page.evaluate(()=>performance.timeOrigin);
 await writeFile(python,'# Temporary backend reload probe\nVALUE = 1\n');
 const before=await waitForNewWorker(health.process_id);
 await page.waitForFunction(previous=>performance.timeOrigin>previous,timeOrigin);
 timeOrigin=await page.evaluate(()=>performance.timeOrigin);
 await writeFile(python,'# Temporary backend reload probe\nVALUE = 2\n');
 await waitForNewWorker(before);
 await page.waitForFunction(previous=>performance.timeOrigin>previous,timeOrigin);
 const refreshed=await page.reload({waitUntil:'domcontentloaded'});
 assert.match(refreshed.headers()['cache-control'],/no-store/);
 await page.locator('nav').getByRole('button',{name:'Simulation Lab',exact:true}).click();
 await page.getByRole('checkbox',{name:/Demo mode/}).waitFor();
 assert.deepEqual(errors,[],'No browser runtime errors');
 console.log('PASS: source frontend, uncached refresh, enabled demo button, live CSS update without losing the test, and Python worker reload.');
}finally{
 await browser.close();
 await Promise.all([css,python].map(path=>unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error})));
}
