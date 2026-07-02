// Polyfills global indexedDB/IDBKeyRange so Dexie (and thus the real storage code, not a mock)
// can run under Vitest's Node environment. Import this before touching HaloPulseDb in tests.
import "fake-indexeddb/auto";
