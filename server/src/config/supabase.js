require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Hard-read the .env file to bypass any cached environment variables
const envPath = path.resolve(__dirname, '../../.env');
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  if (parsed.SUPABASE_URL) supabaseUrl = parsed.SUPABASE_URL;
  if (parsed.SUPABASE_SERVICE_ROLE_KEY) supabaseKey = parsed.SUPABASE_SERVICE_ROLE_KEY;
}

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = { supabaseAdmin };
