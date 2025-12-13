
import { GoogleGenAI } from "@google/genai";
import { AIResponse, LinkItem, AIProviderConfig } from "../types";
import { addLog } from "./logger";
import { getSettingsLocal } from "./storageService";

// --- Helpers ---

const getEnvValue = (key?: string): string => {
    if (!key) return '';
    // Directly map the keys defined in vite.config.ts
    switch (key) {
        case 'API_KEY': return process.env.API_KEY || '';
        case 'CUSTOM_API_KEY_1': return process.env.CUSTOM_API_KEY_1 || '';
        case 'CUSTOM_API_KEY_2': return process.env.CUSTOM_API_KEY_2 || '';
        case 'CUSTOM_API_KEY_3': return process.env.CUSTOM_API_KEY_3 || '';
        case 'CUSTOM_API_KEY_4': return process.env.CUSTOM_API_KEY_4 || '';
        case 'CUSTOM_API_KEY_5': return process.env.CUSTOM_API_KEY_5 || '';
        default: return '';
    }
};

const resolveApiKey = (config: AIProviderConfig): string => {
    // Priority 1: If manual API Key is entered and Env Slot is NOT selected (or "Manual" mode is active in UI logic), use it.
    // However, the config object stores both. 
    // Logic: If envSlot is present and valid, try to use it.
    
    if (config.envSlot) {
        const val = getEnvValue(config.envSlot);
        if (val) return val;
    }

    // Priority 2: Manual Key
    if (config.apiKey && config.apiKey.trim() !== '') {
        return config.apiKey;
    }

    // Priority 3: Fallback for Google type if nothing else set
    if (config.type === 'google') {
        return process.env.API_KEY || '';
    }
    
    return '';
};

const getActiveConfig = (): AIProviderConfig => {
    const settings = getSettingsLocal(); 
    const config = settings?.aiConfigs?.find(c => c.isActive) || settings?.aiConfigs?.[0];
    
    // Fallback default
    if (!config) {
        return { 
            id: 'default', 
            name: 'Default', 
            type: 'google', 
            baseUrl: '', 
            apiKey: process.env.API_KEY || '', 
            model: 'gemini-2.5-flash', 
            isActive: true 
        };
    }

    const resolvedKey = resolveApiKey(config);
    return { ...config, apiKey: resolvedKey };
};

const handleAiError = (error: any, context: string): Error => {
    const errorMessage = (error as any)?.message || String(error) || '未知错误';
    addLog('error', `AI ${context} 失败: ${errorMessage}`);
    return error instanceof Error ? error : new Error(String(errorMessage));
};

const normalizeBaseUrl = (url: string): string => {
    if (!url) return '';
    return url.trim().replace(/\/$/, '');
};

const cleanJsonString = (text: string): string => {
    let clean = text.replace(/```json\n?|```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    const lastBrace = clean.lastIndexOf('}');
    const lastBracket = clean.lastIndexOf(']');
    
    if (firstBrace > -1 && lastBrace > -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        return clean.substring(firstBrace, lastBrace + 1);
    }
    if (firstBracket > -1 && lastBracket > -1) {
        return clean.substring(firstBracket, lastBracket + 1);
    }
    return clean;
};

// --- Core Functionality ---

const getThinkingConfig = (modelName: string) => {
    if (modelName.includes('gemini-2.5') || modelName.includes('gemini-2.0')) {
        return { thinkingConfig: { thinkingBudget: 0 } };
    }
    return undefined;
};

const getModelConfig = (modelName: string) => {
    const thinking = getThinkingConfig(modelName);
    return { 
        ...(thinking || {}),
        responseMimeType: "application/json" 
    };
};

export const analyzeUrl = async (url: string): Promise<AIResponse> => {
  const config = getActiveConfig();
  if (!config.apiKey) throw new Error("API Key 未配置 (Check Environment Variables)");

  // Updated Prompt for better Pros/Cons (4-8 chars)
  const promptText = `Analyze this URL: "${url}".
  Return a JSON object in Simplified Chinese.
  Requirements:
  1. "title": Concise name.
  2. "description": 10-15 word summary.
  3. "brandColor": Hex code.
  4. "pros": A short phrase (4-8 chars) highlighting the best feature (e.g. "完全免费开源", "功能极其强大").
  5. "cons": A short phrase (4-8 chars) highlighting a limitation (e.g. "国内访问较慢", "需注册使用").
  
  JSON Format:
  { "title": "", "description": "", "brandColor": "#hex", "pros": "", "cons": "" }`;

  try {
    let rawText = '';
    if (config.type === 'google') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const response = await ai.models.generateContent({
            model: config.model || 'gemini-2.5-flash',
            contents: promptText,
            config: getModelConfig(config.model)
        });
        rawText = response.text || '';
    } else {
        // OpenAI compatible
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        const endpoint = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: "user", content: promptText }]
            })
        });
        const data = await res.json();
        rawText = data.choices?.[0]?.message?.content || '';
    }
    
    return JSON.parse(cleanJsonString(rawText)) as AIResponse;
  } catch (error) {
    throw handleAiError(error, '网址分析');
  }
};

export const generateCategoryLinks = async (categoryTitle: string, count: number, existingUrls: string[] = []): Promise<Partial<LinkItem>[]> => {
  const config = getActiveConfig();
  if (!config.apiKey) return [];
  
  // Updated Prompt for better Pros/Cons
  const promptText = `List ${count} BEST, HIGH-QUALITY websites for the category "${categoryTitle}".
  Output a JSON Array in Simplified Chinese.
  Requirements:
  1. "pros": Short phrase (4-8 chars) e.g. "拥有海量资源".
  2. "cons": Short phrase (4-8 chars) e.g. "部分功能收费".
  3. Exclude these URLs: ${existingUrls.slice(0, 10).join(',')}
  
  JSON Format:
  [{ "title": "", "url": "https://...", "description": "", "color": "#hex", "pros": "", "cons": "" }]`;

  try {
    let rawText = '';
    if (config.type === 'google') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const response = await ai.models.generateContent({
            model: config.model || 'gemini-2.5-flash',
            contents: promptText,
            config: getModelConfig(config.model)
        });
        rawText = response.text || '';
    } else {
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        const endpoint = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: "user", content: promptText }]
            })
        });
        const data = await res.json();
        rawText = data.choices?.[0]?.message?.content || '';
    }

    return JSON.parse(cleanJsonString(rawText));
  } catch (error) {
     throw handleAiError(error, '内容生成');
  }
};

export const getAiGreeting = async (): Promise<string> => {
  const config = getActiveConfig();
  if (!config.apiKey) return "";
  
  const promptText = `Generate ONE short, scenic, or philosophical sentence in Simplified Chinese.
  Constraints:
  1. STRICTLY SIMPLIFIED CHINESE ONLY. NO ENGLISH.
  2. Max 15 characters.
  3. No lists, no options.
  4. Example: "星河滚烫，你是人间理想。"`;

  try {
     let text = '';
     if (config.type === 'google') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const response = await ai.models.generateContent({ 
            model: config.model || 'gemini-2.5-flash', 
            contents: promptText, 
            config: getThinkingConfig(config.model || 'gemini-2.5-flash')
        });
        text = response.text?.trim() || "";
     } else {
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        const endpoint = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: "user", content: promptText }]
            })
        });
        const data = await res.json();
        text = data.choices?.[0]?.message?.content?.trim() || "";
     }
     return text.replace(/[^\u4e00-\u9fa5，。？！]/g, '').trim(); 
  } catch { return ""; }
};

export const suggestIcon = async (text: string): Promise<string> => {
  const config = getActiveConfig();
  if (!config.apiKey) return "Folder"; // Default safe fallback
  
  const promptText = `Suggest the BEST SINGLE Lucide React icon name for "${text}".
  Examples: "Video" -> "Play", "Code" -> "Code2", "Design" -> "Palette", "Game" -> "Gamepad2".
  Output STRICTLY ONLY the icon string name. No quotes.`;
  
  try {
    let iconName = 'Folder';
    if (config.type === 'google') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const response = await ai.models.generateContent({ 
            model: config.model || 'gemini-2.5-flash', 
            contents: promptText, 
            config: getThinkingConfig(config.model || 'gemini-2.5-flash') 
        });
        iconName = response.text?.trim().split(/[\s"']+/)[0] || "Folder";
    } else {
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        const endpoint = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: "user", content: promptText }]
            })
        });
        const data = await res.json();
        iconName = data.choices?.[0]?.message?.content?.trim().split(/[\s"']+/)[0] || "Folder";
    }
    return iconName;
  } catch { return "Folder"; }
};

export const testAiConnection = async (config: AIProviderConfig) => {
    const key = resolveApiKey(config);
    if (!key) return { success: false, message: 'API Key 未找到 (请检查环境变量配置)' };
    
    try {
        if (config.type === 'google') {
             const ai = new GoogleGenAI({ apiKey: key });
             await ai.models.generateContent({ model: config.model || 'gemini-2.5-flash', contents: 'Hi' });
        } else {
             const baseUrl = normalizeBaseUrl(config.baseUrl);
             const endpoint = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
             await fetch(endpoint, { 
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                 body: JSON.stringify({ model: config.model, messages: [{role: 'user', content: 'hi'}] })
             });
        }
        return { success: true, message: '连接成功 (Connected)' };
    } catch (e: any) {
        return { success: false, message: '连接失败: ' + (e.message || 'Unknown Error') };
    }
};

export const fetchAiModels = async (config: AIProviderConfig) => {
    return ['gemini-2.5-flash', 'gemini-3-pro-preview', 'gpt-4o'];
};
