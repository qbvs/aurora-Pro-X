
import { Category, AppSettings, SearchEngine } from '../types';
import { addLog } from './logger';

const DATA_KEY = 'aurora_data_v1';
const SETTINGS_KEY = 'aurora_settings_v1';
const ENGINES_KEY = 'aurora_engines_v1';

// Helper to check if any KV is configured
export const isKVConfigured = (): boolean => {
  const isVercel = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const isCloudflare = !!(process.env.CF_ACCOUNT_ID && process.env.CF_NAMESPACE_ID && process.env.CF_API_TOKEN);
  return isVercel || isCloudflare;
};

// --- Cloud Sync Helpers (Vercel KV & Cloudflare KV REST API) ---

const kvFetch = async (command: string, key: string, value?: any) => {
  const isVercel = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const isCloudflare = !!(process.env.CF_ACCOUNT_ID && process.env.CF_NAMESPACE_ID && process.env.CF_API_TOKEN);

  if (!isVercel && !isCloudflare) return null;

  try {
    if (isCloudflare) {
      // --- Cloudflare KV REST API Logic ---
      const { CF_ACCOUNT_ID, CF_NAMESPACE_ID, CF_API_TOKEN } = process.env;
      const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_NAMESPACE_ID}`;
      const headers = { Authorization: `Bearer ${CF_API_TOKEN}` };

      if (command.toUpperCase() === 'GET') {
        const response = await fetch(`${baseUrl}/values/${key}`, { headers });
        if (!response.ok) {
          if (response.status === 404) return null; // Key not found is not an error
          throw new Error(`Cloudflare GET Error (${response.status}): ${await response.text()}`);
        }
        return response.json(); // CF returns the value directly
      } else if (command.toUpperCase() === 'SET') {
        const response = await fetch(`${baseUrl}/values/${key}`, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(value)
        });
        if (!response.ok) throw new Error(`Cloudflare SET Error (${response.status}): ${await response.text()}`);
        const result = await response.json();
        return result.success ? value : null;
      }

    } else if (isVercel) {
      // --- Vercel KV REST API Logic (Existing) ---
      const baseUrl = process.env.KV_REST_API_URL?.replace(/\/$/, '');
      const url = `${baseUrl}/`;
      const token = process.env.KV_REST_API_TOKEN;

      const body = value !== undefined 
        ? JSON.stringify([command, key, JSON.stringify(value)])
        : JSON.stringify([command, key]);

      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: body,
      });

      if (!response.ok) throw new Error(`Vercel KV Error (${response.status}): ${await response.text()}`);
      
      const result = await response.json();
      if (result.error) throw new Error(`Vercel KV Command Error: ${result.error}`);

      if (result.result) {
         try {
           return typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
         } catch {
           return result.result;
         }
      }
    }
    return null;
  } catch (error) {
    const msg = (error as any)?.message || String(error);
    addLog('error', `KV Sync Exception: ${msg.substring(0, 150)}`);
    return null;
  }
};


// --- Generic Helpers ---

const saveToLocal = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
};

const getFromLocal = <T>(key: string): T | null => {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};

// --- Categories ---

export const saveCategories = async (categories: Category[]) => {
  saveToLocal(DATA_KEY, categories);
  if (isKVConfigured()) kvFetch('SET', DATA_KEY, categories);
};

export const loadCategories = async (): Promise<Category[] | null> => {
  return getFromLocal<Category[]>(DATA_KEY);
};

export const syncCategoriesFromCloud = async (): Promise<Category[] | null> => {
  if (!isKVConfigured()) return null;
  const cloudData = await kvFetch('GET', DATA_KEY);
  if (cloudData && Array.isArray(cloudData)) {
      saveToLocal(DATA_KEY, cloudData);
      return cloudData;
  }
  return null;
};

// --- Settings ---

export const saveSettings = async (settings: AppSettings) => {
  saveToLocal(SETTINGS_KEY, settings);
  if (isKVConfigured()) kvFetch('SET', SETTINGS_KEY, settings);
};

export const getSettingsLocal = (): AppSettings | null => {
    return getFromLocal<AppSettings>(SETTINGS_KEY);
};

export const loadSettings = async (): Promise<AppSettings | null> => {
  return getFromLocal<AppSettings>(SETTINGS_KEY);
};

export const syncSettingsFromCloud = async (): Promise<AppSettings | null> => {
    if (!isKVConfigured()) return null;
    const cloudData = await kvFetch('GET', SETTINGS_KEY);
    if (cloudData) {
        saveToLocal(SETTINGS_KEY, cloudData);
        return cloudData as AppSettings;
    }
    return null;
};

// --- Search Engines ---

export const saveSearchEngines = async (engines: SearchEngine[]) => {
  saveToLocal(ENGINES_KEY, engines);
  if (isKVConfigured()) kvFetch('SET', ENGINES_KEY, engines);
};

export const loadSearchEngines = async (): Promise<SearchEngine[] | null> => {
  return getFromLocal<SearchEngine[]>(ENGINES_KEY);
};

export const syncSearchEnginesFromCloud = async (): Promise<SearchEngine[] | null> => {
    if (!isKVConfigured()) return null;
    const cloudData = await kvFetch('GET', ENGINES_KEY);
    if (cloudData && Array.isArray(cloudData)) {
        saveToLocal(ENGINES_KEY, cloudData);
        return cloudData;
    }
    return null;
};