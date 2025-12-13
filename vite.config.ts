import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // This loads .env files
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // MERGE: explicitly read from process.env to capture Vercel/Cloudflare system variables
  // during the build process, which ensures variables set in the Dashboard are picked up.
  const envVars = {
    API_KEY: env.API_KEY || process.env.API_KEY || '',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '',
    
    // Vercel KV
    KV_REST_API_URL: env.KV_REST_API_URL || process.env.KV_REST_API_URL || '',
    KV_REST_API_TOKEN: env.KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || '',
    
    // Cloudflare KV
    CF_ACCOUNT_ID: env.CF_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || '',
    CF_NAMESPACE_ID: env.CF_NAMESPACE_ID || process.env.CF_NAMESPACE_ID || '',
    CF_API_TOKEN: env.CF_API_TOKEN || process.env.CF_API_TOKEN || '',
    
    // Custom API Keys
    CUSTOM_API_KEY_1: env.CUSTOM_API_KEY_1 || process.env.CUSTOM_API_KEY_1 || '',
    CUSTOM_API_KEY_2: env.CUSTOM_API_KEY_2 || process.env.CUSTOM_API_KEY_2 || '',
    CUSTOM_API_KEY_3: env.CUSTOM_API_KEY_3 || process.env.CUSTOM_API_KEY_3 || '',
    CUSTOM_API_KEY_4: env.CUSTOM_API_KEY_4 || process.env.CUSTOM_API_KEY_4 || '',
    CUSTOM_API_KEY_5: env.CUSTOM_API_KEY_5 || process.env.CUSTOM_API_KEY_5 || '',
  };
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve((process as any).cwd(), './'),
      },
    },
    define: {
      // We explicitly map each key to the merged envVars object
      'process.env.API_KEY': JSON.stringify(envVars.API_KEY),
      'process.env.ADMIN_PASSWORD': JSON.stringify(envVars.ADMIN_PASSWORD),
      // Vercel KV
      'process.env.KV_REST_API_URL': JSON.stringify(envVars.KV_REST_API_URL),
      'process.env.KV_REST_API_TOKEN': JSON.stringify(envVars.KV_REST_API_TOKEN),
      // Cloudflare KV
      'process.env.CF_ACCOUNT_ID': JSON.stringify(envVars.CF_ACCOUNT_ID),
      'process.env.CF_NAMESPACE_ID': JSON.stringify(envVars.CF_NAMESPACE_ID),
      'process.env.CF_API_TOKEN': JSON.stringify(envVars.CF_API_TOKEN),
      // Custom API Keys
      'process.env.CUSTOM_API_KEY_1': JSON.stringify(envVars.CUSTOM_API_KEY_1),
      'process.env.CUSTOM_API_KEY_2': JSON.stringify(envVars.CUSTOM_API_KEY_2),
      'process.env.CUSTOM_API_KEY_3': JSON.stringify(envVars.CUSTOM_API_KEY_3),
      'process.env.CUSTOM_API_KEY_4': JSON.stringify(envVars.CUSTOM_API_KEY_4),
      'process.env.CUSTOM_API_KEY_5': JSON.stringify(envVars.CUSTOM_API_KEY_5)
    }
  };
});