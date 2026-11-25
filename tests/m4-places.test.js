import test from 'node:test';
import { createInitialStore } from '../src/data/seed.js';
import { MemoryRepository } from '../src/db/memoryRepository.js';
import { contract, fixtures } from './contracts/m4PlacesContract.js';
const store = createInitialStore();
store.places = fixtures();
store.repo = new MemoryRepository(store);
contract(test, {}, () => store);
