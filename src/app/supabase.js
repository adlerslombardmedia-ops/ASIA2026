import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

// ─── Offline stub: keeps the UI working before the database is connected ──
function makeQuery() {
  const result = { data: [], error: null, count: 0 };
  const q = {
    then: (res, rej) => Promise.resolve(result).then(res, rej),
    catch: (rej) => Promise.resolve(result).catch(rej),
    finally: (f) => Promise.resolve(result).finally(f),
  };
  return new Proxy(q, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve({ data: null, error: null });
      return () => makeQuery();
    },
  });
}

function makeChannel() {
  const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => Promise.resolve('ok'), send: () => Promise.resolve('ok') };
  return ch;
}

const offline = {
  from: () => makeQuery(),
  rpc: () => Promise.resolve({ data: null, error: { message: 'Database not connected yet' } }),
  channel: () => makeChannel(),
  removeChannel: () => Promise.resolve('ok'),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ error: { message: 'Database not connected yet' } }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Database not connected yet' } }),
    signUp: () => Promise.resolve({ data: null, error: { message: 'Database not connected yet' } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

export const supabase = isConfigured
  ? createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } })
  : offline;
