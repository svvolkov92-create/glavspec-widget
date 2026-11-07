'use strict';
// Starts one smoke with its own profile folder: electron smoke-env.js <smoke.js> <outDir>.
// Must run before src/main.js, which derives userData from app.getPath('appData') when loaded.
const { app } = require('electron');
const path = require('node:path');

const profile = process.env.GLAVSPEC_TEST_APPDATA;
if (!profile) throw new Error('GLAVSPEC_TEST_APPDATA is not set');
app.setPath('appData', profile);
require(path.resolve(process.argv.at(-2)));
