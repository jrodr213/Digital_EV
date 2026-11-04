const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {backendCommand, isLocalURL, isExternalURL} = require('../backend.cjs');

test('packaged builds start the bundled engine and do not require a local Python install', () => {
  assert.deepEqual(backendCommand({packaged: true, resourcesPath: '/app/resources', platform: 'win32'}),
    {command: path.join('/app/resources', 'backend', 'ev-twin-backend.exe'), args: []});
  assert.deepEqual(backendCommand({packaged: true, resourcesPath: '/app/resources', platform: 'darwin'}),
    {command: path.join('/app/resources', 'backend', 'ev-twin-backend'), args: []});
});

test('only the exact engine origin receives the desktop session credential', () => {
  const origin = 'http://127.0.0.1:49152';
  assert.equal(isLocalURL(origin + '/api/components', origin), true);
  for (const value of ['http://127.0.0.1:8000/api/health', 'http://127.0.0.1.attacker.test:49152/',
                        'https://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'malformed']) {
    assert.equal(isLocalURL(value, origin), false);
  }
});

test('supplier links may open the system browser without launching arbitrary protocols', () => {
  assert.equal(isExternalURL('https://www.aliexpress.us/item/3256806152602316.html'), true);
  for (const value of ['file:///tmp/program', 'javascript:alert(1)', 'shell:AppsFolder', 'data:text/html,test']) {
    assert.equal(isExternalURL(value), false);
  }
});
