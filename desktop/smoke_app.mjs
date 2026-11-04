import {_electron as electron} from '../frontend/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const desktop = path.dirname(fileURLToPath(import.meta.url));
const defaultExecutable = process.platform === 'darwin'
  ? path.join(desktop, 'release', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'EV Twin.app/Contents/MacOS/EV Twin')
  : path.join(desktop, 'release', process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked', process.platform === 'win32' ? 'EV Twin.exe' : 'ev-twin');
const executablePath = process.env.EV_DESKTOP_EXECUTABLE ?? defaultExecutable;
const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'ev-twin-native-smoke-'));
const errors = [];
let application, page;
const env = {...process.env, EV_DESKTOP_DATA_DIR: dataDirectory};
delete env.ELECTRON_RUN_AS_NODE;

async function launch() {
  application = await electron.launch({executablePath, env, timeout: 90000,
    args: process.env.CI && process.platform === 'linux'
      ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []});
  const page = await application.firstWindow({timeout: 90000});
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Choose a car', {exact: true}).waitFor();
  return page;
}

try {
  page = await launch();
  const runtime = await application.evaluate(({app}) => ({packaged: app.isPackaged, version: app.getVersion()}));
  assert.equal(runtime.packaged, true, 'Test the packaged executable, not development Electron.');
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
  await page.getByLabel('Choose a car', {exact: true}).selectOption('team-ev-single-motor');
  await page.getByRole('button', {name: 'Open car', exact: true}).click();
  const explorer = page.getByRole('region', {name: 'Interactive vehicle explorer'});
  await explorer.locator('canvas').waitFor();
  await page.waitForFunction(() => document.querySelector('.vehicle-explorer canvas') && !document.querySelector('.explorer-failure'));
  await page.getByText('Build records & purchase planning', {exact: true}).click();
  const records = page.locator('.project-details');
  await records.getByRole('button', {name: 'Conditional parts (2)', exact: true}).click();
  assert.match(await records.innerText(), /\$14\.14/);
  assert.match(await records.innerText(), /\$29\.21/);
  const simulation = await page.evaluate(async () => {
    const response = await fetch('/api/runs', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({vehicle_id: 'team-ev-single-motor', demo_mode: true})});
    return {status: response.status, result: await response.json()};
  });
  assert.equal(simulation.status, 200);
  assert.equal(simulation.result.engine, 'FASTSim');
  assert.ok(simulation.result.samples.length > 0);
  await mkdir(path.join(desktop, 'build'), {recursive: true});
  await page.screenshot({path: path.join(desktop, 'build/desktop-smoke.png'), fullPage: true});
  await application.close();
  application = undefined;
  page = await launch();
  const history = await page.evaluate(async () => (await fetch('/api/results')).json());
  assert.ok(history.some(result => result.id === simulation.result.id), 'Saved simulations survive restarting the app.');
  assert.deepEqual(errors, []);
  await writeFile(path.join(desktop, 'build/desktop-smoke.json'), JSON.stringify({
    platform: process.platform, arch: process.arch, version: runtime.version,
    packaged: true, webgl: true, fastsim: '3.1.0', restartPersistence: true, browserErrors: errors,
  }, null, 2) + '\n');
  console.log('PASS: packaged native app, sandboxed frontend, WebGL car, current parts/prices, real FASTSim and saved results after restart.');
} catch (error) {
  await mkdir(path.join(desktop, 'build'), {recursive: true});
  if (page && !page.isClosed()) {
    await page.screenshot({path: path.join(desktop, 'build/desktop-smoke.png'), fullPage: true}).catch(() => {});
    await writeFile(path.join(desktop, 'build/desktop-smoke-errors.txt'), JSON.stringify({
      browserErrors: errors, body: await page.locator('body').innerText().catch(() => ''),
    }, null, 2));
  }
  try {console.error(await readFile(path.join(dataDirectory, 'desktop.log'), 'utf8'));} catch {}
  throw error;
} finally {
  if (application) await application.close();
  await rm(dataDirectory, {recursive: true, force: true});
}
