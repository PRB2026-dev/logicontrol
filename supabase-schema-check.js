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
  console.error('Missing SUPABASE_URL or key in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  console.log('SUPABASE_URL=', url);
  console.log('Testing SELECT on jobs with estado_adicional...');
  const selectRes = await supabase.from('jobs').select('id,estado_adicional').limit(1);
  console.log('selectRes=', JSON.stringify(selectRes, null, 2));

  console.log('Testing SELECT on jobs with estado_entrega...');
  const selectRes2 = await supabase.from('jobs').select('id,estado_entrega').limit(1);
  console.log('selectRes2=', JSON.stringify(selectRes2, null, 2));

  console.log('Testing INSERT with minimal row...');
  const insertRes = await supabase.from('jobs').insert([{ status: 'Booking' }]);
  console.log('insertRes=', JSON.stringify(insertRes, null, 2));

  console.log('Testing INSERT with estado_adicional null row...');
  const insertRes2 = await supabase.from('jobs').insert([{ status: 'Booking', estado_adicional: null }]);
  console.log('insertRes2=', JSON.stringify(insertRes2, null, 2));
})().catch((err) => {
  console.error('UNCAUGHT ERROR', err);
  process.exit(1);
});
