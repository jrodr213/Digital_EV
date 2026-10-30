// Read-only browser check: opens an existing demo and its exported review.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base=process.env.EV_BASE_URL??'http://127.0.0.1:8000';
const browser=await chromium.launch({channel:process.env.EV_BROWSER??'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
page.setDefaultTimeout(20000);
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const snapshot=async()=>JSON.stringify(await Promise.all(['components','vehicles','results'].map(async path=>(await page.request.get(`${base}/api/${path}`)).json())));
try{
 const before=await snapshot();
 const runs=await (await page.request.get(`${base}/api/results`)).json();
 const demo=runs.find(run=>run.request.demo_mode&&run.request.vehicle_id==='team-ev-belt');
 assert.ok(demo,'Save a main-build demo once before running this read-only review check.');
 const saved=await (await page.request.get(`${base}/api/results/${demo.id}`)).json();
 assert.ok(saved.demo_review);
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('nav').getByRole('button',{name:'Performance Results',exact:true}).click();
 await page.getByLabel('Saved result').selectOption(demo.id);
 const review=page.getByRole('region',{name:'Demo shortfalls and improvement summary'});
 await review.getByRole('heading',{name:'Demo shortfalls & room for improvement',exact:true}).waitFor();
 assert.equal(await review.locator('.demo-finding').count(),saved.demo_review.findings.length);
 for(const finding of saved.demo_review.findings){
  const card=review.locator('article').filter({has:page.getByRole('heading',{name:finding.title,exact:true})});
  assert.equal(await card.locator('.demo-finding-evidence').innerText(),finding.evidence.trim());
  await card.getByText('Room for improvement',{exact:true}).waitFor();
 }
 assert.equal(await review.locator('.demo-next-steps li').count(),4);
 await review.getByText(/No gears, shared drive axle, belts or chains are added/).waitFor();
 assert.equal(await page.getByText('Torque shortfall in the assumed configuration',{exact:true}).count(),1,'Avoid duplicate torque summaries');
 const reportHref=await page.getByRole('link',{name:'Export test report'}).getAttribute('href');
 const report=await page.request.get(`${base}${reportHref}`);
 assert.equal(report.status(),200);
 assert.match(await report.text(),/## Demo shortfalls & room for improvement/);
 assert.match(await report.text(),/### Suggested order of work/);
 await mkdir('../docs/screenshots',{recursive:true});
 await review.screenshot({path:'../docs/screenshots/demo-improvement-summary.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Summary mobile overflow');
 await review.getByRole('heading',{name:'Suggested order of work',exact:true}).scrollIntoViewIfNeeded();
 assert.deepEqual(errors,[],'Browser runtime errors');
 assert.equal(await snapshot(),before,'Reading reviews must not change saved inputs or simulation history');
 console.log('PASS: existing demo review, all quantified findings, direct-drive improvement plan, readable report, mobile layout and unchanged saved history.');
}finally{await browser.close()}
