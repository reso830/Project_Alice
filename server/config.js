import process from 'node:process';

const VALID_RUNTIMES = ['local', 'hosted'];
const HOSTED_REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
];

export function loadConfig() {
  const runtime = process.env.APP_RUNTIME ?? 'local';

  if (!VALID_RUNTIMES.includes(runtime)) {
    throw new Error(
      `Invalid APP_RUNTIME: "${runtime}". Valid values: "local", "hosted".`,
    );
  }

  if (runtime === 'hosted') {
    for (const key of HOSTED_REQUIRED) {
      if (!process.env[key]) {
        throw new Error(
          `Missing required environment variable for hosted mode: ${key}`,
        );
      }
    }
  }

  return Object.freeze({
    runtime,
    isHosted: runtime === 'hosted',
    port: Number(process.env.PORT) || 3001,
    supabase:
      runtime === 'hosted'
        ? {
            url: process.env.SUPABASE_URL,
            anonKey: process.env.SUPABASE_ANON_KEY,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            jwtSecret: process.env.SUPABASE_JWT_SECRET,
          }
        : null,
  });
}

export const config = loadConfig();
