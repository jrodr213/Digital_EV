// Browser integration check against a running local server. Uses installed Edge.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
page.setDefaultTimeout(20000);
const failures=[];page.on('pageerror',e=>failures.push(e.message));
try{
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
 console.log('Application loaded.');
 await page.getByRole('heading',{name:'Home Dashboard',exact:true}).waitFor();
 await page.getByText('Assembly inputs complete',{exact:false}).waitFor();
 await page.locator('canvas').first().waitFor();
 await mkdir('../docs/screenshots',{recursive:true});
 await page.screenshot({path:'../docs/screenshots/dashboard.png',fullPage:true,timeout:20000});
 console.log('Dashboard and WebGL rendered.');
 for(const name of ['Component Library','Vehicle Builder','3D Vehicle Viewer','Simulation Lab','Performance Results','Vehicle Comparison','Saved Projects']){
  await page.locator('nav').getByRole('button',{name,exact:true}).click();
  await page.getByRole('heading',{name,exact:true}).waitFor();
 }
 await page.locator('nav').getByRole('button',{name:'Component Library',exact:true}).click();
 await page.getByRole('button',{name:'New component',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByLabel('Part name',{exact:true}).fill('Browser smoke test / sensor');
 await page.getByRole('dialog').locator('label').filter({has:page.locator('span').getByText('Category',{exact:true})}).locator('select').selectOption('sensors');
 await page.getByRole('button',{name:'Save reviewed specifications'}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 const row=page.getByRole('row').filter({hasText:'Browser smoke test / sensor'});
 await row.waitFor();await row.getByTitle('Delete',{exact:true}).click();await row.waitFor({state:'hidden'});
 await page.locator('nav').getByRole('button',{name:'Simulation Lab',exact:true}).click();
 await page.getByRole('button',{name:'Run simulation',exact:true}).click();
 await page.getByRole('heading',{name:'Performance Results',exact:true}).waitFor();
 await page.getByText('Cycle energy consumption',{exact:true}).waitFor();
 await page.locator('.js-plotly-plot').first().waitFor();
 await page.screenshot({path:'../docs/screenshots/results.png',fullPage:true});
 const csv=await page.getByRole('link',{name:'Download CSV'}).getAttribute('href');
 const response=await page.request.get(new URL(csv,page.url()).href);assert.equal(response.status(),200);assert.match(await response.text(),/^time_s,/);
 await page.locator('nav').getByRole('button',{name:'3D Vehicle Viewer',exact:true}).click();
 await page.getByRole('button',{name:'Play cycle',exact:true}).click();
 await page.waitForTimeout(1200);
 assert.ok(Number(await page.getByRole('slider',{name:'Simulation playback'}).inputValue())>0);
 await page.setViewportSize({width:390,height:844});
 await page.locator('nav').getByRole('button',{name:'Home Dashboard',exact:true}).click();
 await page.screenshot({path:'../docs/screenshots/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile layout overflows');
 assert.deepEqual(failures,[],'Browser runtime errors');
 console.log('PASS: 8 pages, component create/delete, FASTSim run, Plotly charts, CSV, 3D playback and mobile layout.');
}finally{await browser.close()}
