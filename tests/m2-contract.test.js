
import test from 'node:test';
import { createInitialStore } from '../src/data/seed.js';
import { registerM2Tests } from './contracts/m2.js';
const store = createInitialStore();
registerM2Tests(test, () => store);
