const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = path.resolve(__dirname, '.env');
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const vars = Object.fromEntries(
  env
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\s*([^=]+)=\s*(.*)$/);
      if (!match) return null;
      const [, key, raw] = match;
      const value = raw.replace(/^"|"$/g, '');
      return [key, value];
    })
    .filter(Boolean),
);
const url = vars.SUPABASE_URL || process.env.SUPABASE_URL;
const key = vars.SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or key');
  process.exit(1);
}
const supabase = createClient(url, key);

const extractMissingColumns = (message) => {
  const matches = [...message.matchAll(/Could not find the ['\"]([^'\"]+)['\"] column of ['\"]jobs['\"] in the schema cache/gi)];
  return matches.map((m) => m[1]);
};
const stripColumns = (rows, columns) => rows.map((row) => {
  const copy = { ...row };
  columns.forEach((column) => delete copy[column]);
  return copy;
});

(async () => {
  const rows = [{ status: 'Booking', estado_adicional: 'Borrado', estado_entrega: 'Entregado', anio: 2026, mes: 6, created_by: null }];
  let attempt = 0;
  let currentRows = rows;
  while (attempt < 3) {
    console.log('attempt', attempt, 'payload', currentRows);
    const { data, error } = await supabase.from('jobs').insert(currentRows).select();
    console.log('response', { data, error: error ? { code: error.code, message: error.message } : null });
    if (!error) {
      console.log('success', data);
      break;
    }
    const missing = extractMissingColumns(error.message);
    console.log('missing columns', missing);
    if (!missing.length || attempt === 2) {
      console.error('final error', error.message);
      break;
    }
    currentRows = stripColumns(currentRows, missing);
    attempt++;
  }
})();
