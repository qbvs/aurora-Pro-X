
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Plus, Search, Moon, Sun, LayoutGrid, 
  LogOut, Edit, Trash2, X, Wand2, Globe, AlertCircle, 
  Image as ImageIcon, Upload, Palette, Type as TypeIcon, Lock,
  Activity, CircleCheck, CircleX, Terminal, Bot, Zap, RefreshCw, Key, Server, TriangleAlert, ChevronDown, ChevronRight,
  Flame, ChevronUp, ThumbsUp, ThumbsDown, Monitor, Cpu, Paintbrush, Radio, Link as LinkIcon, Power, Share2, Ellipsis, QrCode, OctagonAlert, Database, Cloud, Github, Mail, Sparkles, ScanLine
} from 'lucide-react';
import { 
  Category, LinkItem, AppSettings, SearchEngine, 
  LogEntry, AIProviderConfig, SocialLink 
} from './types';
import { addLog, subscribeLogs, getLogs, clearLogs, initLogger } from './services/logger';
import { INITIAL_DATA, INITIAL_SETTINGS, INITIAL_SEARCH_ENGINES } from './constants';
import { 
  loadCategories, saveCategories, loadSettings, saveSettings, 
  loadSearchEngines, saveSearchEngines, isKVConfigured,
  syncCategoriesFromCloud, syncSettingsFromCloud, syncSearchEnginesFromCloud
} from './services/storageService';
import { analyzeUrl, generateCategoryLinks, getAiGreeting, suggestIcon, testAiConnection, fetchAiModels } from './services/geminiService';
import { Icon } from './components/Icon';
import { Favicon } from './components/Favicon';
import { Modal } from './components/Modal';
import { cn } from './utils';

// --- Constants ---
const COMMON_REC_ID = 'rec-1'; 

// --- Helper Functions ---
const isFaviconValid = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            const hostname = new URL(url).hostname;
            if (!hostname) { resolve(false); return; }
            const img = new Image();
            img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            setTimeout(() => resolve(false), 3000); 
        } catch {
            resolve(false);
        }
    });
};

const LoadingSpinner = () => <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-600 rounded-full animate-spin" />;

// --- Main App Component ---

type SidebarTab = 'dashboard' | 'general' | 'ai' | 'appearance' | 'search' | 'diagnose';

export const App: React.FC = () => {
  // -- Data State --
  const [categories, setCategories] = useState<Category[]>(INITIAL_DATA);
  const [settings, setLocalSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [searchEngines, setSearchEngines] = useState<SearchEngine[]>(INITIAL_SEARCH_ENGINES);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // -- UI State --
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // -- New UI State --
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [brokenLinks, setBrokenLinks] = useState<Set<string>>(new Set());
  const [showQrModal, setShowQrModal] = useState<string | null>(null);

  // -- Inputs --
  const [searchTerm, setSearchTerm] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // -- Dynamic Content --
  const [currentTime, setCurrentTime] = useState<string>('');
  const [aiGreeting, setAiGreeting] = useState<string>('');
  const [clock, setClock] = useState(new Date()); 

  // -- Modals & Editing --
  const [editingLink, setEditingLink] = useState<{ catId: string, link?: LinkItem } | null>(null);
  const [showGenLinksModal, setShowGenLinksModal] = useState<{catId: string, title: string} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);
  
  // Forms
  const [linkForm, setLinkForm] = useState<Partial<LinkItem>>({});
  const [engineForm, setEngineForm] = useState<Partial<SearchEngine>>({});
  const [genCount, setGenCount] = useState(4);
  const [isGeneratingLinks, setIsGeneratingLinks] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isIconSuggesting, setIsIconSuggesting] = useState(false);

  // Social Form
  const [socialForm, setSocialForm] = useState<Partial<SocialLink>>({});
  const [showSocialQrInput, setShowSocialQrInput] = useState(false);

  // AI Config Forms
  const [editingAiConfig, setEditingAiConfig] = useState<AIProviderConfig | null>(null);
  const [aiKeySource, setAiKeySource] = useState<'manual' | 'env'>('manual');
  const [testStatus, setTestStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'fail', message?: string }>({ status: 'idle' });
  
  // --- Initialization Logic ---
  const updateCommonRecommendations = (cats: Category[]): Category[] => {
      let allLinks: LinkItem[] = [];
      const seenUrls = new Set<string>();
      cats.forEach(cat => {
          if (cat.id === COMMON_REC_ID) return;
          cat.links.forEach(link => {
             const normalizedUrl = link.url.trim().replace(/\/$/, '');
             if (!seenUrls.has(normalizedUrl)) {
                 allLinks.push(link);
                 seenUrls.add(normalizedUrl);
             }
          });
      });
      allLinks.sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
      const topLinks = allLinks.slice(0, 8);
      const newCommonCat: Category = {
          id: COMMON_REC_ID,
          title: '常用推荐',
          icon: 'Flame',
          links: topLinks.map(l => ({...l, id: `rec-${l.id}`}))
      };
      const commonCatIndex = cats.findIndex(c => c.id === COMMON_REC_ID);
      if (commonCatIndex >= 0) {
          const newCats = [...cats];
          newCats[commonCatIndex] = newCommonCat;
          return newCats;
      } else {
          return [newCommonCat, ...cats];
      }
  };

  useEffect(() => { const unsub = subscribeLogs(() => setLogs(getLogs())); setLogs(getLogs()); return unsub; }, []);
  useEffect(() => { if (localStorage.getItem('aurora_auth') === 'true') setIsAuthenticated(true); }, []);

  useEffect(() => {
    // Initialize Global Error Handler
    initLogger();

    const init = async () => {
      setIsLoadingData(true);
      try {
          const [localCats, localSets, localEngines] = await Promise.all([loadCategories(), loadSettings(), loadSearchEngines()]);
          if (localCats) setCategories(updateCommonRecommendations(localCats));
          else setCategories(updateCommonRecommendations(INITIAL_DATA));
          
          if (localSets) setLocalSettings({ ...INITIAL_SETTINGS, ...localSets, socialLinks: localSets.socialLinks || INITIAL_SETTINGS.socialLinks });
          if (localEngines) setSearchEngines(localEngines);
          addLog('info', '本地数据加载完成');
      } catch (e) { console.error(e); }
      setIsLoadingData(false);

      if (isKVConfigured()) {
          try {
              const [c, s, e] = await Promise.all([syncCategoriesFromCloud(), syncSettingsFromCloud(), syncSearchEnginesFromCloud()]);
              if (c) { setCategories(updateCommonRecommendations(c)); addLog('info', '云端同步成功'); }
              if (s) setLocalSettings(p => ({...p, ...s, socialLinks: s.socialLinks || p.socialLinks}));
              if (e) setSearchEngines(e);
          } catch (err) { console.error(err); }
      }
    };
    init();
    const h = new Date().getHours();
    setCurrentTime(h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好');
  }, []);

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  // --- Dynamic Favicon & Title Effect ---
  useEffect(() => {
      // 1. Update Title
      document.title = `${settings.appName} | 个人导航`;

      // 2. Update Favicon
      const updateFavicon = () => {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
          }

          if (settings.logoMode === 'image' && settings.customLogoUrl) {
              link.href = settings.customLogoUrl;
          } else {
              // Convert PascalCase (e.g. Zap, LayoutGrid) to kebab-case (zap, layout-grid) for CDN mapping
              const iconName = settings.appIcon || 'Zap';
              const kebabIcon = iconName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
              link.href = `https://unpkg.com/lucide-static@latest/icons/${kebabIcon}.svg`;
          }
      };
      updateFavicon();
  }, [settings.appName, settings.appIcon, settings.logoMode, settings.customLogoUrl]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);
  useEffect(() => { if (editingAiConfig) { setAiKeySource(editingAiConfig.envSlot ? 'env' : 'manual'); setTestStatus({ status: 'idle' }); } }, [editingAiConfig]);

  // AI Greeting
  useEffect(() => {
      if (!settings.enableAiGreeting) return;
      const cached = localStorage.getItem('aurora_greeting_v7'); 
      if (cached) {
          const { text, expiry } = JSON.parse(cached);
          if (Date.now() < expiry) { setAiGreeting(text); return; }
      }
      getAiGreeting().then(text => {
          if (text) {
              setAiGreeting(text);
              localStorage.setItem('aurora_greeting_v7', JSON.stringify({ text, expiry: Date.now() + 14400000 }));
          }
      });
  }, [settings.enableAiGreeting]);

  // --- Logic Helpers ---

  const getUniqueSiteCount = () => {
      const urls = new Set<string>();
      categories.forEach(c => {
          if (c.id === COMMON_REC_ID) return;
          c.links.forEach(l => {
              try {
                  const u = new URL(l.url);
                  urls.add(u.hostname + u.pathname.replace(/\/$/, ''));
              } catch {
                  urls.add(l.url);
              }
          });
      });
      return urls.size;
  };

  const handleCategoryTitleBlur = async (catId: string, newTitle: string, currentIcon: string) => {
      handleSaveData(categories); 
      if (newTitle && newTitle.length > 1 && (!currentIcon || currentIcon === 'Folder')) {
          try {
              const suggested = await suggestIcon(newTitle);
              if (suggested && suggested !== 'Folder') {
                  const newCats = categories.map(c => c.id === catId ? { ...c, icon: suggested } : c);
                  setCategories(newCats);
                  await saveCategories(newCats);
                  addLog('info', `AI 自动更新图标: ${suggested}`);
              }
          } catch (e) {
              console.error(e);
          }
      }
  };

  const exitEditMode = () => {
      setIsEditMode(false);
      addLog('info', '返回主页');
  };

  // --- Actions ---

  const handleSaveData = async (newCats: Category[]) => {
      const updated = updateCommonRecommendations(newCats);
      setCategories(updated);
      await saveCategories(updated);
  };
  
  const handleLinkClick = async (category: Category, link: LinkItem) => {
      window.open(link.url, settings.openInNewTab ? '_blank' : '_self');
      const newCats = categories.map(cat => {
          if (cat.id === COMMON_REC_ID) return cat;
          const hasLink = cat.links.some(l => l.url === link.url);
          return hasLink ? { ...cat, links: cat.links.map(l => l.url === link.url ? { ...l, clickCount: (l.clickCount || 0) + 1 } : l) } : cat;
      });
      handleSaveData(newCats);
  };

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); if (!process.env.ADMIN_PASSWORD || passwordInput === process.env.ADMIN_PASSWORD) { setIsAuthenticated(true); localStorage.setItem('aurora_auth', 'true'); setShowLoginModal(false); setIsEditMode(true); setLoginError(''); setPasswordInput(''); addLog('info', '管理员登录成功'); } else { setLoginError('密码错误'); } };
  const handleSaveLink = async () => { if (!editingLink || !linkForm.title || !linkForm.url) return; const isValid = await isFaviconValid(linkForm.url); if (!isValid && !confirm('该链接似乎无法加载图标，是否仍要添加？')) return; const newLink: LinkItem = { id: linkForm.id || `l-${Date.now()}`, title: linkForm.title, url: linkForm.url.startsWith('http') ? linkForm.url : `https://${linkForm.url}`, description: linkForm.description || '', color: linkForm.color || '#666', clickCount: linkForm.clickCount || 0, pros: linkForm.pros, cons: linkForm.cons }; let newCats = categories.map(cat => { if (cat.id !== editingLink.catId) return cat; return editingLink.link ? { ...cat, links: cat.links.map(l => l.id === editingLink.link!.id ? newLink : l) } : { ...cat, links: [...cat.links, newLink] }; }); handleSaveData(newCats); setEditingLink(null); setLinkForm({}); addLog('info', `链接已保存: ${newLink.title}`); };
  const handleGenerateCategoryLinks = async () => { if (!showGenLinksModal) return; setIsGeneratingLinks(true); try { const allExistingUrls = new Set<string>(); categories.forEach(cat => cat.links.forEach(link => allExistingUrls.add(link.url.toLowerCase().replace(/\/$/, "")))); const existingInCat = categories.find(c => c.id === showGenLinksModal.catId)?.links.map(l => l.url) || []; const newLinks = await generateCategoryLinks(showGenLinksModal.title, genCount, existingInCat); const validLinks: LinkItem[] = []; for (const l of newLinks) { if (!l.url || !l.title) continue; const normalizedUrl = l.url.toLowerCase().replace(/\/$/, ""); if (allExistingUrls.has(normalizedUrl)) continue; if (await isFaviconValid(l.url)) { validLinks.push({ id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, title: l.title, url: l.url, description: l.description || '', color: l.color || '#666', clickCount: 0, pros: l.pros, cons: l.cons }); allExistingUrls.add(normalizedUrl); } } if (validLinks.length === 0) return alert("AI 生成未找到有效新链接"); let newCats = categories.map(cat => cat.id !== showGenLinksModal.catId ? cat : { ...cat, links: [...cat.links, ...validLinks] }); handleSaveData(newCats); setShowGenLinksModal(null); addLog('info', `AI 添加了 ${validLinks.length} 个链接`); } catch { alert('生成失败'); } finally { setIsGeneratingLinks(false); } };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'bg' | 'qr') => { 
      const file = e.target.files?.[0]; 
      if (!file) return; 
      if (file.size > 2 * 1024 * 1024) { alert('文件大小不能超过 2MB'); return; } 
      const reader = new FileReader(); 
      reader.onloadend = () => { 
          const result = reader.result as string; 
          if (type === 'qr') {
              setSocialForm(prev => ({...prev, qrCode: result}));
              addLog('info', 'QR 二维码上传成功');
              return;
          }
          const newSettings = { ...settings }; 
          if (type === 'logo') { 
              newSettings.customLogoUrl = result; 
              newSettings.logoMode = 'image'; 
          } else { 
              newSettings.customBackgroundImage = result; 
              newSettings.backgroundMode = 'custom'; 
          } 
          setLocalSettings(newSettings); 
          saveSettings(newSettings); 
          addLog('info', `${type === 'logo' ? 'Logo' : '背景'} 图片已更新`); 
      }; 
      reader.readAsDataURL(file); 
  };

  const handleAddAiProvider = () => { const newConfig: AIProviderConfig = { id: `ai-${Date.now()}`, name: 'New Provider', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-3.5-turbo', isActive: false }; const newConfigs = [...settings.aiConfigs, newConfig]; const newSettings = { ...settings, aiConfigs: newConfigs }; setLocalSettings(newSettings); saveSettings(newSettings); setEditingAiConfig(newConfig); };
  
  // Smart Search Engine Detection
  const autoFillSearchEngine = (url: string) => { 
      if (!url) return; 
      try { 
          const fullUrl = url.startsWith('http') ? url : `https://${url}`; 
          const urlObj = new URL(fullUrl); 
          const hostname = urlObj.hostname.toLowerCase().replace('www.', ''); 
          
          let name = '';
          let searchPattern = '';

          // Known patterns
          if (hostname.includes('google')) { name = 'Google'; searchPattern = 'https://www.google.com/search?q='; }
          else if (hostname.includes('baidu')) { name = 'Baidu'; searchPattern = 'https://www.baidu.com/s?wd='; }
          else if (hostname.includes('bing')) { name = 'Bing'; searchPattern = 'https://www.bing.com/search?q='; }
          else if (hostname.includes('duckduckgo')) { name = 'DuckDuckGo'; searchPattern = 'https://duckduckgo.com/?q='; }
          else if (hostname.includes('sogou')) { name = 'Sogou'; searchPattern = 'https://www.sogou.com/web?query='; }
          else if (hostname.includes('yahoo')) { name = 'Yahoo'; searchPattern = 'https://search.yahoo.com/search?p='; }
          else {
              // Fallback heuristic
              const parts = hostname.split('.');
              name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
              searchPattern = `${urlObj.origin}/search?q=`;
          }

          setEngineForm({ 
              ...engineForm, 
              baseUrl: urlObj.origin, 
              name: engineForm.name || name, 
              searchUrlPattern: engineForm.searchUrlPattern || searchPattern 
          }); 
          addLog('info', `智能识别搜索引擎: ${name}`);
      } catch (e) { } 
  };

  const toggleTheme = () => { const modes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']; const currentIndex = modes.indexOf(settings.theme); const nextMode = modes[(currentIndex + 1) % modes.length]; const newSettings = { ...settings, theme: nextMode }; setLocalSettings(newSettings); saveSettings(newSettings); };
  const handleSettingsClick = () => { if (isAuthenticated) { setIsEditMode(true); } else { setShowLoginModal(true); } };
  const toggleCategoryExpand = (catId: string) => { const newSet = new Set(expandedCategories); if (newSet.has(catId)) { newSet.delete(catId); } else { newSet.add(catId); } setExpandedCategories(newSet); };
  const toggleSectionVisibility = (catId: string) => { const newSet = new Set(collapsedCategories); if (newSet.has(catId)) { newSet.delete(catId); } else { newSet.add(catId); } setCollapsedCategories(newSet); };
  const handleTestConnection = async (config: AIProviderConfig) => { setTestStatus({ status: 'loading' }); const result = await testAiConnection(config); setTestStatus({ status: result.success ? 'success' : 'fail', message: result.message }); };
  const handleDeleteAiProvider = (id: string) => { if (!confirm('确定删除此 AI 配置吗？')) return; const newConfigs = settings.aiConfigs.filter(c => c.id !== id); const newSettings = { ...settings, aiConfigs: newConfigs }; setLocalSettings(newSettings); saveSettings(newSettings); setEditingAiConfig(null); };
  const handleAiFillLink = async () => { if (!linkForm.url) return; setIsAiLoading(true); try { const result = await analyzeUrl(linkForm.url); setLinkForm(prev => ({ ...prev, title: result.title, description: result.description, pros: result.pros, cons: result.cons, color: result.brandColor })); addLog('info', 'AI 链接分析完成'); } catch (e: any) { alert('AI 分析失败: ' + e.message); } finally { setIsAiLoading(false); } };

  // New Actions
  const handleAiSuggestIcon = async () => {
      if (!settings.appName) return;
      setIsIconSuggesting(true);
      try {
          const icon = await suggestIcon(settings.appName);
          const n = {...settings, appIcon: icon};
          setLocalSettings(n);
          saveSettings(n);
          addLog('info', `AI 推荐图标: ${icon}`);
      } catch {
          addLog('error', 'AI 推荐图标失败');
      } finally {
          setIsIconSuggesting(false);
      }
  };

  const autoFillSocialLink = (url: string) => {
      if (!url) return;
      try {
          const u = new URL(url.startsWith('http') ? url : `https://${url}`);
          const host = u.hostname.toLowerCase();
          let platform = '';
          let icon = 'Link';

          if (host.includes('github')) { platform = 'GitHub'; icon = 'Github'; }
          else if (host.includes('twitter') || host.includes('x.com')) { platform = 'X (Twitter)'; icon = 'Twitter'; }
          else if (host.includes('youtube')) { platform = 'YouTube'; icon = 'Youtube'; }
          else if (host.includes('linkedin')) { platform = 'LinkedIn'; icon = 'Linkedin'; }
          else if (host.includes('instagram')) { platform = 'Instagram'; icon = 'Instagram'; }
          else if (host.includes('facebook')) { platform = 'Facebook'; icon = 'Facebook'; }
          else if (host.includes('wechat') || host.includes('weixin')) { platform = 'WeChat'; icon = 'MessageCircle'; }
          else if (host.includes('mail')) { platform = 'Email'; icon = 'Mail'; }
          
          setSocialForm(prev => ({ ...prev, url: url, platform: prev.platform || platform, icon: prev.icon || icon }));
      } catch {}
  };

  // --- Render Components ---

  const renderSidebar = () => (
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen fixed left-0 top-0 z-50">
          <div className="p-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white"><Settings size={18}/></div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">管理后台</h1>
              <button onClick={exitEditMode} className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all" title="返回主页">
                  <Power size={20}/>
              </button>
          </div>
          
          <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
              {[
                  { id: 'dashboard', label: '仪表盘 / 链接', icon: LayoutGrid },
                  { id: 'general', label: '基础设置', icon: Settings },
                  { id: 'ai', label: 'AI 服务', icon: Bot },
                  { id: 'appearance', label: '外观效果', icon: Palette },
                  { id: 'search', label: '搜索引擎', icon: Search },
                  { id: 'diagnose', label: '系统日志', icon: Terminal },
              ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setActiveTab(item.id as SidebarTab)}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                        activeTab === item.id 
                            ? "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300" 
                            : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-gray-400"
                    )}
                  >
                      <item.icon size={18}/>
                      {item.label}
                  </button>
              ))}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
              <div className={cn("px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2", isKVConfigured() ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                  <div className={cn("w-2 h-2 rounded-full", isKVConfigured() ? "bg-emerald-500" : "bg-red-500")}/>
                  {isKVConfigured() ? "已连接 Vercel KV" : "未连接数据库"}
              </div>
              <button onClick={() => { setIsAuthenticated(false); localStorage.removeItem('aurora_auth'); setIsEditMode(false); }} className="w-full flex items-center gap-2 text-red-500 hover:text-red-600 px-4 py-2 text-sm font-bold">
                  <LogOut size={16}/> 退出登录
              </button>
          </div>
      </aside>
  );

  const renderDashboardContent = () => (
      <div className="space-y-8 animate-fade-in">
          {categories.map((category, idx) => (
              <div key={category.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-violet-600 dark:text-violet-400"><Icon name={category.icon} size={20}/></div>
                          <input 
                            value={category.title}
                            onChange={(e) => { const n = [...categories]; n[idx].title = e.target.value; setCategories(n); }}
                            onBlur={() => handleCategoryTitleBlur(category.id, category.title, category.icon)}
                            className="text-lg font-bold bg-transparent outline-none border-b border-transparent focus:border-violet-500 w-40"
                          />
                      </div>
                      {category.id !== COMMON_REC_ID && (
                          <div className="flex items-center gap-2">
                              <button onClick={() => setShowGenLinksModal({catId: category.id, title: category.title})} className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 rounded-lg text-xs font-bold hover:bg-violet-200"><Wand2 size={14}/> AI 填充</button>
                              <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-2"/>
                              <button onClick={() => { const n = [...categories]; [n[idx], n[idx-1]] = [n[idx-1], n[idx]]; handleSaveData(n); }} disabled={idx <= 1} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronUp size={16}/></button>
                              <button onClick={() => { const n = [...categories]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; handleSaveData(n); }} disabled={idx === categories.length-1} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronDown size={16}/></button>
                              <button onClick={() => { if(confirm('确定删除此分类?')) { const n = categories.filter(c => c.id !== category.id); handleSaveData(n); }}} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                          </div>
                      )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {category.links.map(link => {
                          const isBroken = brokenLinks.has(link.id);
                          return (
                              <div key={link.id} className={cn("group relative p-4 rounded-xl border flex items-start gap-3 bg-white dark:bg-slate-900 hover:shadow-md transition-all", isBroken ? "border-red-200 bg-red-50" : "border-gray-100 dark:border-gray-700")}>
                                  <Favicon url={link.url} size={32} className="rounded-lg shadow-sm" onLoadError={() => setBrokenLinks(p => new Set(p).add(link.id))}/>
                                  <div className="flex-1 min-w-0">
                                      <div className="font-bold text-sm truncate">{link.title}</div>
                                      <div className="text-xs text-gray-400 truncate mt-0.5">{link.description}</div>
                                  </div>
                                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 p-1 rounded border shadow-sm">
                                      <button onClick={() => { setEditingLink({catId: category.id, link}); setLinkForm({...link}); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit size={12}/></button>
                                      <button onClick={() => { const n = categories.map(c => c.id===category.id?{...c, links: c.links.filter(l=>l.id!==link.id)}:c); handleSaveData(n); }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                                  </div>
                              </div>
                          );
                      })}
                      {category.id !== COMMON_REC_ID && (
                          <button onClick={() => { setEditingLink({ catId: category.id }); setLinkForm({ color: '#666666' }); }} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-all min-h-[80px]">
                              <Plus size={20}/>
                              <span className="text-xs font-bold">添加链接</span>
                          </button>
                      )}
                  </div>
              </div>
          ))}
          <button onClick={() => handleSaveData([...categories, { id: `cat-${Date.now()}`, title: '新分类', icon: 'Folder', links: [] }])} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl text-gray-400 font-bold hover:border-violet-500 hover:text-violet-600 transition-all flex items-center justify-center gap-2">
              <Plus size={20}/> 添加新分类
          </button>
      </div>
  );

  const renderGeneralSettings = () => (
      <div className="space-y-8 animate-fade-in">
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Settings className="text-violet-500"/> 基本信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-sm font-bold text-gray-500 mb-2">应用名称</label>
                      <input 
                          value={settings.appName} 
                          onChange={(e) => { const n = {...settings, appName: e.target.value}; setLocalSettings(n); saveSettings(n); }}
                          className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-violet-500 transition-colors"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-gray-500 mb-2">Logo 模式</label>
                      <div className="flex bg-gray-50 dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                          {(['icon', 'image'] as const).map(m => (
                              <button 
                                  key={m}
                                  onClick={() => { const n = {...settings, logoMode: m}; setLocalSettings(n); saveSettings(n); }}
                                  className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", settings.logoMode === m ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600" : "text-gray-400 hover:text-gray-600")}
                              >
                                  {m === 'icon' ? '图标' : '图片'}
                              </button>
                          ))}
                      </div>
                  </div>
                  {settings.logoMode === 'icon' ? (
                      <div>
                          <label className="block text-sm font-bold text-gray-500 mb-2">图标名称 (Lucide React)</label>
                          <div className="flex gap-2">
                              <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/20 text-violet-600 flex items-center justify-center shrink-0">
                                  <Icon name={settings.appIcon} size={24}/>
                              </div>
                              <div className="flex-1 flex gap-2">
                                  <input 
                                      value={settings.appIcon} 
                                      onChange={(e) => { const n = {...settings, appIcon: e.target.value}; setLocalSettings(n); saveSettings(n); }}
                                      className="flex-1 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-violet-500 transition-colors font-mono"
                                  />
                                  <button onClick={handleAiSuggestIcon} disabled={isIconSuggesting} className="px-4 bg-violet-100 text-violet-600 rounded-xl font-bold hover:bg-violet-200 transition-colors flex items-center gap-2 text-xs">
                                      {isIconSuggesting ? <LoadingSpinner/> : <Sparkles size={16}/>} 智能推荐
                                  </button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div>
                          <label className="block text-sm font-bold text-gray-500 mb-2">上传 Logo</label>
                          <div className="flex items-center gap-2">
                              {settings.customLogoUrl && <img src={settings.customLogoUrl} className="w-12 h-12 rounded-xl object-contain bg-gray-100"/>}
                              <input 
                                  placeholder="https://..." 
                                  value={settings.customLogoUrl || ''} 
                                  onChange={(e) => { const n = {...settings, customLogoUrl: e.target.value}; setLocalSettings(n); saveSettings(n); }}
                                  className="flex-1 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 outline-none text-sm"
                              />
                              <label className="cursor-pointer px-4 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 rounded-xl text-sm font-bold flex items-center gap-2 shrink-0">
                                  <Upload size={16}/> 上传
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'logo')}/>
                              </label>
                          </div>
                      </div>
                  )}
              </div>
          </section>

          <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><LinkIcon className="text-violet-500"/> 社交链接</h3>
               <div className="space-y-3 mb-4">
                  {settings.socialLinks?.map((link, idx) => (
                      <div key={link.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-gray-700">
                          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-gray-500"><Icon name={link.icon} size={18}/></div>
                          <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm flex items-center gap-2">
                                  {link.platform}
                                  {link.qrCode && <span title="包含二维码"><ScanLine size={12} className="text-emerald-500"/></span>}
                              </div>
                              <div className="text-xs text-gray-400 truncate">{link.url}</div>
                          </div>
                          <button onClick={() => { 
                              const newLinks = settings.socialLinks.filter(l => l.id !== link.id);
                              const n = {...settings, socialLinks: newLinks};
                              setLocalSettings(n); saveSettings(n);
                          }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                  ))}
               </div>
               
               <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                   <div className="flex gap-2 mb-3">
                       <input 
                          placeholder="链接 URL (支持自动识别)" 
                          value={socialForm.url || ''} 
                          onChange={e => { setSocialForm({...socialForm, url: e.target.value}); autoFillSocialLink(e.target.value); }} 
                          className="flex-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 text-sm outline-none"
                       />
                       <button onClick={() => autoFillSocialLink(socialForm.url || '')} className="px-3 bg-violet-100 text-violet-600 rounded-xl font-bold text-xs hover:bg-violet-200"><Wand2 size={16}/></button>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3 mb-3">
                       <input placeholder="平台 (GitHub)" value={socialForm.platform || ''} onChange={e => setSocialForm({...socialForm, platform: e.target.value})} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 text-sm outline-none"/>
                       <input placeholder="图标 (Github)" value={socialForm.icon || ''} onChange={e => setSocialForm({...socialForm, icon: e.target.value})} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 text-sm outline-none"/>
                   </div>

                   {showSocialQrInput ? (
                       <div className="flex gap-2 mb-3 animate-fade-in">
                           <input placeholder="二维码 URL / Base64" value={socialForm.qrCode || ''} onChange={e => setSocialForm({...socialForm, qrCode: e.target.value})} className="flex-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 text-sm outline-none"/>
                           <label className="cursor-pointer px-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center hover:bg-gray-50">
                               <Upload size={16} className="text-gray-500"/>
                               <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'qr')}/>
                           </label>
                       </div>
                   ) : (
                       <button onClick={() => setShowSocialQrInput(true)} className="text-xs text-gray-400 hover:text-violet-500 flex items-center gap-1 mb-3 font-bold">+ 添加二维码 (WeChat 等)</button>
                   )}

                   <button onClick={() => {
                       if(!socialForm.platform || !socialForm.url) return;
                       const newLink: SocialLink = {
                           id: `sl-${Date.now()}`,
                           platform: socialForm.platform,
                           url: socialForm.url,
                           icon: socialForm.icon || 'Link',
                           qrCode: socialForm.qrCode
                       };
                       const n = {...settings, socialLinks: [...(settings.socialLinks || []), newLink]};
                       setLocalSettings(n); saveSettings(n);
                       setSocialForm({});
                       setShowSocialQrInput(false);
                   }} className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 flex items-center justify-center gap-2"><Plus size={18}/> 添加社交链接</button>
               </div>
          </section>
          
           <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><TypeIcon className="text-violet-500"/> 页脚 HTML</h3>
              <textarea 
                  value={settings.footerHtml} 
                  onChange={(e) => { const n = {...settings, footerHtml: e.target.value}; setLocalSettings(n); saveSettings(n); }}
                  className="w-full h-24 p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-violet-500 font-mono text-sm"
                  placeholder="© 2024 Aurora Pro..."
              />
          </section>
      </div>
  );

  const renderSearchSettings = () => (
      <div className="space-y-8 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Search className="text-blue-500"/> 搜索引擎管理</h3>
               <div className="space-y-3">
                   {searchEngines.map(se => (
                       <div key={se.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
                           <Favicon url={se.baseUrl} className="rounded-lg"/>
                           <div className="flex-1">
                               <div className="font-bold text-gray-800 dark:text-gray-200">{se.name}</div>
                               <div className="text-xs text-gray-400 truncate max-w-[300px]">{se.searchUrlPattern}</div>
                           </div>
                           <div className="flex gap-2">
                               <button 
                                  onClick={() => { const n = {...settings, activeSearchEngineId: se.id}; setLocalSettings(n); saveSettings(n); }}
                                  disabled={settings.activeSearchEngineId === se.id}
                                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", settings.activeSearchEngineId === se.id ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-white dark:bg-slate-800 border hover:border-violet-500 hover:text-violet-500")}
                               >
                                  {settings.activeSearchEngineId === se.id ? "使用中" : "设为默认"}
                               </button>
                               <button 
                                  onClick={() => {
                                      if(searchEngines.length <= 1) return alert('至少保留一个搜索引擎');
                                      if(settings.activeSearchEngineId === se.id) return alert('无法删除当前使用的搜索引擎');
                                      const n = searchEngines.filter(s => s.id !== se.id);
                                      setSearchEngines(n); saveSearchEngines(n);
                                  }}
                                  className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                               >
                                  <Trash2 size={16}/>
                               </button>
                           </div>
                       </div>
                   ))}
               </div>

               <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                   <h4 className="font-bold text-sm text-gray-500 mb-4">添加新引擎</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                       <div className="md:col-span-2 relative">
                            <input 
                              placeholder="URL (e.g. https://duckduckgo.com)" 
                              value={engineForm.baseUrl || ''} 
                              onChange={e => { setEngineForm({...engineForm, baseUrl: e.target.value}); autoFillSearchEngine(e.target.value); }} 
                              className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 outline-none"
                            />
                            {engineForm.baseUrl && <div className="absolute right-3 top-3 text-emerald-500 pointer-events-none text-xs font-bold flex items-center gap-1"><Sparkles size={12}/> 智能识别开启</div>}
                       </div>
                       <input 
                          placeholder="名称 (e.g. DuckDuckGo)" 
                          value={engineForm.name || ''} 
                          onChange={e => setEngineForm({...engineForm, name: e.target.value})} 
                          className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 outline-none"
                       />
                       <input 
                          placeholder="搜索串 (e.g. .../search?q=)" 
                          value={engineForm.searchUrlPattern || ''} 
                          onChange={e => setEngineForm({...engineForm, searchUrlPattern: e.target.value})} 
                          className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 outline-none"
                       />
                   </div>
                   <button 
                      onClick={() => {
                          if(!engineForm.name || !engineForm.baseUrl || !engineForm.searchUrlPattern) return;
                          const newSe: SearchEngine = {
                              id: `se-${Date.now()}`,
                              name: engineForm.name,
                              baseUrl: engineForm.baseUrl,
                              searchUrlPattern: engineForm.searchUrlPattern
                          };
                          const n = [...searchEngines, newSe];
                          setSearchEngines(n); saveSearchEngines(n);
                          setEngineForm({});
                      }}
                      className="w-full py-3 bg-gray-100 dark:bg-slate-700 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 text-gray-600 dark:text-gray-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                   >
                       <Plus size={18}/> 添加搜索引擎
                   </button>
               </div>
          </div>
      </div>
  );

  const renderLogs = () => (
      <div className="space-y-4 animate-fade-in h-full flex flex-col">
          <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2"><Terminal className="text-gray-500"/> 系统日志</h3>
              <button onClick={clearLogs} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">清空日志</button>
          </div>
          <div className="flex-1 bg-gray-900 rounded-2xl p-4 overflow-y-auto font-mono text-xs custom-scrollbar border border-gray-800 shadow-inner">
              {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600">
                      <Terminal size={32} className="mb-2 opacity-50"/>
                      <p>暂无日志记录</p>
                  </div>
              ) : (
                  <div className="space-y-2">
                      {logs.map(log => (
                          <div key={log.id} className="flex gap-3 text-gray-300 border-b border-gray-800/50 pb-1 last:border-0 hover:bg-white/5 p-1 rounded">
                              <span className="text-gray-500 shrink-0 select-none">[{log.time}]</span>
                              <span className={cn("uppercase font-bold shrink-0 w-12", log.level === 'error' ? "text-red-400" : log.level === 'warn' ? "text-amber-400" : "text-emerald-400")}>{log.level}</span>
                              <span className="break-all whitespace-pre-wrap">{log.message}</span>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>
  );

  const renderAISettings = () => (
      <div className="space-y-8 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Bot className="text-violet-500"/> AI 模型配置</h3>
               <p className="text-sm text-gray-500 mb-4">配置用于生成链接推荐、智能图标和欢迎语的 AI 服务。</p>
               
               <div className="space-y-3">
                   {settings.aiConfigs.map(config => (
                       <div key={config.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
                           <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", config.type === 'google' ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600")}>
                               {config.type === 'google' ? <Zap size={20}/> : <Bot size={20}/>}
                           </div>
                           <div className="flex-1">
                               <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                   {config.name}
                                   {config.isActive && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">使用中</span>}
                               </div>
                               <div className="text-xs text-gray-400 font-mono mt-0.5">{config.model}</div>
                           </div>
                           <div className="flex gap-2">
                               <button 
                                  onClick={() => {
                                      const newConfigs = settings.aiConfigs.map(c => ({...c, isActive: c.id === config.id}));
                                      const n = {...settings, aiConfigs: newConfigs};
                                      setLocalSettings(n); saveSettings(n);
                                  }}
                                  disabled={config.isActive}
                                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", config.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 opacity-50 cursor-default" : "bg-white dark:bg-slate-800 border hover:border-violet-500 hover:text-violet-500")}
                               >
                                  {config.isActive ? "默认" : "设为默认"}
                               </button>
                               <button 
                                  onClick={() => setEditingAiConfig(config)}
                                  className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                               >
                                  <Settings size={16}/>
                               </button>
                           </div>
                       </div>
                   ))}
               </div>

               <button 
                  onClick={handleAddAiProvider}
                  className="mt-4 w-full py-3 bg-white dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-violet-500 hover:text-violet-600 text-gray-400 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
               >
                   <Plus size={18}/> 添加 AI 服务商
               </button>
          </div>
      </div>
  );

  const renderAppearance = () => (
      <div className="space-y-8 animate-fade-in">
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Palette className="text-pink-500"/> 主题与背景</h3>
               
               <div className="space-y-6">
                   <div>
                      <label className="block text-sm font-bold text-gray-500 mb-3">色彩模式</label>
                      <div className="flex bg-gray-50 dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                          {(['light', 'dark', 'system'] as const).map(m => (
                              <button 
                                  key={m}
                                  onClick={() => { const n = {...settings, theme: m}; setLocalSettings(n); saveSettings(n); }}
                                  className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2", settings.theme === m ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600" : "text-gray-400 hover:text-gray-600")}
                              >
                                  {m === 'light' && <Sun size={16}/>}
                                  {m === 'dark' && <Moon size={16}/>}
                                  {m === 'system' && <Monitor size={16}/>}
                                  <span className="capitalize">{m === 'system' ? '系统' : m === 'light' ? '亮色' : '暗色'}</span>
                              </button>
                          ))}
                      </div>
                   </div>

                   <div>
                      <label className="block text-sm font-bold text-gray-500 mb-3">背景风格</label>
                      <div className="grid grid-cols-3 gap-3">
                          {[
                              { id: 'aurora', label: '极光', icon: Sparkles },
                              { id: 'monotone', label: '纯净', icon: LayoutGrid },
                              { id: 'custom', label: '自定义', icon: ImageIcon },
                          ].map((item) => (
                              <button
                                  key={item.id}
                                  onClick={() => { const n = {...settings, backgroundMode: item.id as any}; setLocalSettings(n); saveSettings(n); }}
                                  className={cn("flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all", settings.backgroundMode === item.id ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-600" : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 text-gray-400 hover:border-gray-300")}
                              >
                                  <item.icon size={24}/>
                                  <span className="text-xs font-bold">{item.label}</span>
                              </button>
                          ))}
                      </div>
                   </div>

                   {settings.backgroundMode === 'custom' && (
                       <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 animate-fade-in">
                           <div className="flex items-center gap-4">
                               {settings.customBackgroundImage ? (
                                   <img src={settings.customBackgroundImage} className="w-20 h-20 rounded-lg object-cover bg-gray-200"/>
                               ) : (
                                   <div className="w-20 h-20 rounded-lg bg-gray-200 dark:bg-slate-800 flex items-center justify-center text-gray-400"><ImageIcon size={24}/></div>
                               )}
                               <div className="flex-1">
                                   <input 
                                       placeholder="图片 URL" 
                                       value={settings.customBackgroundImage || ''}
                                       onChange={(e) => { const n = {...settings, customBackgroundImage: e.target.value}; setLocalSettings(n); saveSettings(n); }}
                                       className="w-full p-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 outline-none mb-2 bg-white dark:bg-slate-900"
                                   />
                                   <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-200 dark:bg-slate-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
                                       <Upload size={14}/> 上传图片
                                       <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'bg')}/>
                                   </label>
                               </div>
                           </div>
                       </div>
                   )}
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                           <div className="flex justify-between mb-2">
                               <label className="text-sm font-bold text-gray-500">卡片透明度</label>
                               <span className="text-xs font-mono bg-gray-100 dark:bg-slate-700 px-2 rounded text-gray-600 dark:text-gray-300">{settings.cardOpacity}%</span>
                           </div>
                           <input 
                              type="range" min="20" max="100" 
                              value={settings.cardOpacity} 
                              onChange={(e) => { const n = {...settings, cardOpacity: Number(e.target.value)}; setLocalSettings(n); saveSettings(n); }}
                              className="w-full accent-violet-600 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                           />
                       </div>
                       
                       <div>
                           <div className="flex justify-between mb-2">
                               <label className="text-sm font-bold text-gray-500">背景模糊度</label>
                               <span className="text-xs font-mono bg-gray-100 dark:bg-slate-700 px-2 rounded text-gray-600 dark:text-gray-300">{settings.backgroundBlur}px</span>
                           </div>
                           <input 
                              type="range" min="0" max="50" 
                              value={settings.backgroundBlur} 
                              onChange={(e) => { const n = {...settings, backgroundBlur: Number(e.target.value)}; setLocalSettings(n); saveSettings(n); }}
                              className="w-full accent-violet-600 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                           />
                       </div>

                        <div>
                           <div className="flex justify-between mb-2">
                               <label className="text-sm font-bold text-gray-500">背景遮罩浓度</label>
                               <span className="text-xs font-mono bg-gray-100 dark:bg-slate-700 px-2 rounded text-gray-600 dark:text-gray-300">{settings.backgroundMaskOpacity}%</span>
                           </div>
                           <input 
                              type="range" min="0" max="90" 
                              value={settings.backgroundMaskOpacity} 
                              onChange={(e) => { const n = {...settings, backgroundMaskOpacity: Number(e.target.value)}; setLocalSettings(n); saveSettings(n); }}
                              className="w-full accent-violet-600 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                           />
                       </div>

                       <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-gray-700">
                           <span className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                               <Sparkles size={16} className="text-amber-500"/> AI 每日欢迎语
                           </span>
                           <button 
                              onClick={() => { const n = {...settings, enableAiGreeting: !settings.enableAiGreeting}; setLocalSettings(n); saveSettings(n); }}
                              className={cn("w-12 h-6 rounded-full p-1 transition-colors relative", settings.enableAiGreeting ? "bg-violet-500" : "bg-gray-300 dark:bg-slate-700")}
                           >
                               <div className={cn("w-4 h-4 bg-white rounded-full shadow-sm transition-transform", settings.enableAiGreeting ? "translate-x-6" : "translate-x-0")}/>
                           </button>
                       </div>
                   </div>
               </div>
          </section>
      </div>
  );

  const renderViewMode = () => (
        <div className="min-h-screen text-gray-800 dark:text-gray-200 font-sans transition-colors duration-300 relative overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 z-0">
                {settings.backgroundMode === 'custom' && settings.customBackgroundImage ? (
                    <img src={settings.customBackgroundImage} className="w-full h-full object-cover"/>
                ) : settings.backgroundMode === 'aurora' ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900 animate-gradient"/>
                ) : (
                    <div className="absolute inset-0 bg-gray-50 dark:bg-slate-950"/>
                )}
                <div className="absolute inset-0 backdrop-blur-[var(--blur)] bg-black/[var(--mask)] transition-all" style={{ '--blur': `${settings.backgroundBlur}px`, '--mask': `${settings.backgroundMaskOpacity / 100}` } as any} />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                <header className="flex items-center justify-between py-6">
                    <div className="flex items-center gap-3">
                        {settings.logoMode === 'icon' ? (
                            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30"><Icon name={settings.appIcon} size={24}/></div>
                        ) : (
                            <img src={settings.customLogoUrl} className="w-10 h-10 rounded-xl object-contain bg-white/80 backdrop-blur shadow-sm" />
                        )}
                        <h1 className="text-2xl font-bold tracking-tight">{settings.appName}</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={toggleTheme} className="w-10 h-10 rounded-full bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center transition-all shadow-sm">
                            {settings.theme === 'dark' ? <Moon size={20} className="text-indigo-400"/> : <Sun size={20} className="text-amber-500"/>}
                        </button>
                        <button onClick={handleSettingsClick} className="w-10 h-10 rounded-full bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center transition-all shadow-sm group">
                            <Settings size={20} className="group-hover:rotate-90 transition-transform"/>
                        </button>
                    </div>
                </header>

                <div className="flex flex-col items-center py-12 mb-8 animate-fade-in-up">
                    <div className="text-center mb-10 select-none">
                        <h1 className="text-7xl font-bold tracking-tighter tabular-nums mb-4 drop-shadow-sm bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                            {clock.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', second: '2-digit'})}
                        </h1>
                        <div className="text-sm font-bold text-gray-500 uppercase tracking-[0.3em] mb-4">{clock.toLocaleDateString('zh-CN', {month:'long', day:'numeric', weekday:'long'})}</div>
                        <p className="text-2xl md:text-3xl font-bold tracking-tight opacity-90">
                            <span className="font-normal mr-2 opacity-70">{currentTime}，</span>
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400">{aiGreeting || "精诚所至，金石为开。"}</span>
                        </p>
                    </div>
                    
                    <div className="w-full max-w-2xl relative group mb-8">
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-400/30 to-fuchsia-400/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
                        <form onSubmit={(e) => { e.preventDefault(); if(searchTerm) window.open(searchEngines.find(s=>s.id===settings.activeSearchEngineId)?.searchUrlPattern + encodeURIComponent(searchTerm), '_blank'); }} className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-2 flex items-center transition-all group-focus-within:ring-2 ring-violet-500/50 transform group-hover:scale-[1.01]">
                            <div className="pl-4 pr-3 border-r border-gray-200 dark:border-gray-700 mr-2 opacity-70"><Favicon url={searchEngines.find(s=>s.id===settings.activeSearchEngineId)?.baseUrl || ''} size={24}/></div>
                            <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder={`在 ${searchEngines.find(s=>s.id===settings.activeSearchEngineId)?.name} 上搜索...`} className="flex-1 bg-transparent outline-none text-lg h-12 text-gray-800 dark:text-white placeholder-gray-400"/>
                            <button type="submit" className="p-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-transform hover:scale-105 shadow-md"><Search/></button>
                        </form>
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex gap-4">
                            {searchEngines.map(se => (
                                <button 
                                key={se.id} 
                                onClick={() => { setLocalSettings(p=>({...p, activeSearchEngineId: se.id})); saveSettings({...settings, activeSearchEngineId: se.id}); }}
                                className={cn("px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold transition-all", settings.activeSearchEngineId === se.id ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 ring-1 ring-violet-500/50" : "bg-white/50 dark:bg-black/20 text-gray-500 hover:bg-white dark:hover:bg-slate-800")}
                                >
                                    <Favicon url={se.baseUrl} size={14} className="rounded-sm"/> {se.name}
                                </button>
                            ))}
                        </div>
                        <div className="px-5 py-2 rounded-full bg-white/60 dark:bg-slate-900/60 backdrop-blur border border-white/40 dark:border-white/5 shadow-sm text-xs font-bold text-gray-500 flex items-center gap-2">
                            <Globe size={14} className="text-violet-500"/>
                            已收录 <span className="text-gray-800 dark:text-white font-black">{getUniqueSiteCount()}</span> 个优质站点
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                {categories.map((category) => {
                    const isCommonRecs = category.id === COMMON_REC_ID;
                    const isExpanded = expandedCategories.has(category.id);
                    const isSectionCollapsed = collapsedCategories.has(category.id);
                    const limit = isCommonRecs ? 8 : 4;
                    const visibleLinks = isExpanded || isCommonRecs ? category.links : category.links.slice(0, limit);

                    return (
                    <div key={category.id} className="transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6 px-1">
                            <div className="p-2 rounded-xl text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/10">
                                <Icon name={category.icon} size={24} />
                            </div>
                            <h2 className="font-bold text-xl">{category.title}</h2>
                            <button 
                                onClick={() => toggleSectionVisibility(category.id)}
                                className="p-1 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                            >
                                {isSectionCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {!isCommonRecs && !isSectionCollapsed && category.links.length > 4 && (
                                <button onClick={() => toggleCategoryExpand(category.id)} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors">
                                    {isExpanded ? <ChevronUp size={16} /> : <Ellipsis size={16} />}
                                </button>
                            )}
                        </div>
                        {!isSectionCollapsed && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                {visibleLinks.map((link) => (
                                    <div 
                                        key={link.id} 
                                        onClick={() => handleLinkClick(category, link)} 
                                        className="group relative flex flex-col p-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-transparent hover:border-violet-200 dark:hover:border-violet-500/30 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer h-full"
                                        style={{ backgroundColor: `rgba(var(--bg), ${settings.cardOpacity / 100})` }}
                                    >
                                        <div className="flex items-start gap-4 mb-3">
                                            <Favicon url={link.url} size={40} className="shadow-md rounded-xl" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate text-[15px]">{link.title}</h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-5 h-10 line-clamp-2 overflow-hidden">{link.description}</p>
                                            </div>
                                        </div>
                                        <div className="mt-auto flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
                                            {link.pros && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100 dark:border-emerald-500/20 max-w-full truncate"><CircleCheck size={10} className="shrink-0"/> {link.pros}</span>}
                                            {link.cons && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-[10px] font-bold border border-rose-100 dark:border-rose-500/20 max-w-full truncate"><CircleX size={10} className="shrink-0"/> {link.cons}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {!isCommonRecs && category.links.length > 4 && (
                                <div className="mt-4 flex justify-center">
                                    <button onClick={() => toggleCategoryExpand(category.id)} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                                        {isExpanded ? <>收起 <ChevronUp size={14}/></> : <>查看更多 ({category.links.length - 4}) <ChevronDown size={14}/></>}
                                    </button>
                                </div>
                            )}
                        </>
                        )}
                    </div>
                    );
                })}
                </div>

                <footer className="py-10 text-center border-t border-gray-100 dark:border-white/5 mt-20 space-y-6">
                    <div className="flex justify-center gap-4">
                        {settings.socialLinks?.map(link => (
                            <button 
                            key={link.id}
                            onClick={() => {
                                if (link.qrCode) {
                                    setShowQrModal(link.qrCode);
                                } else {
                                    window.open(link.url, '_blank');
                                }
                            }}
                            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-violet-600 hover:text-white transition-all shadow-sm relative group"
                            title={link.platform}
                            >
                                <Icon name={link.icon} size={20}/>
                                {link.qrCode && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />}
                            </button>
                        ))}
                    </div>
                    <div className="text-sm text-gray-400 dark:text-gray-500 font-medium" dangerouslySetInnerHTML={{ __html: settings.footerHtml || '' }}></div>
                </footer>
            </div>
            
            {showLoginModal && (
                <Modal title="管理员登录" onClose={() => setShowLoginModal(false)} icon={<Lock size={20}/>}>
                     <form onSubmit={handleLogin} className="p-6 space-y-4">
                         <p className="text-gray-500 text-sm">请输入管理员密码以进入编辑模式。</p>
                         <input 
                            type="password" 
                            value={passwordInput} 
                            onChange={e => setPasswordInput(e.target.value)} 
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none"
                            placeholder="Password"
                            autoFocus
                         />
                         {loginError && <p className="text-red-500 text-sm font-bold">{loginError}</p>}
                         <button type="submit" className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700">登录</button>
                     </form>
                </Modal>
            )}

            {showQrModal && (
                <Modal title="扫描二维码" onClose={() => setShowQrModal(null)} icon={<ScanLine size={20}/>}>
                    <div className="p-8 flex flex-col items-center justify-center">
                        <div className="p-4 bg-white rounded-xl shadow-lg border border-gray-100">
                            <img src={showQrModal} alt="QR Code" className="max-w-[250px] max-h-[250px] object-contain" />
                        </div>
                        <p className="mt-4 text-sm text-gray-500 font-bold">请使用手机 App 扫码关注</p>
                    </div>
                </Modal>
            )}
        </div>
  );

  // --- View Mode Logic ---
  if (!isEditMode) {
      return renderViewMode();
  }

  // --- Admin Mode Render ---
  return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-gray-200 font-sans flex">
          {renderSidebar()}
          <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
              <div className="max-w-6xl mx-auto">
                  {activeTab === 'dashboard' && renderDashboardContent()}
                  {activeTab === 'general' && renderGeneralSettings()}
                  {activeTab === 'ai' && renderAISettings()}
                  {activeTab === 'appearance' && renderAppearance()}
                  {activeTab === 'search' && renderSearchSettings()}
                  {activeTab === 'diagnose' && renderLogs()}
              </div>
          </main>

          {/* All Modals */}
          {editingAiConfig && (
            <Modal title="编辑 AI 服务" onClose={() => { setEditingAiConfig(null); setTestStatus({ status: 'idle' }); }} icon={<Bot size={20}/>}>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2 text-gray-500">名称</label>
                            <input value={editingAiConfig.name} onChange={e=>setEditingAiConfig({...editingAiConfig, name:e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 text-gray-500">类型</label>
                            <select value={editingAiConfig.type} onChange={e=>setEditingAiConfig({...editingAiConfig, type:e.target.value as any})} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none">
                                <option value="google">Google Gemini SDK</option>
                                <option value="openai">OpenAI Compatible</option>
                            </select>
                        </div>
                    </div>
                    {editingAiConfig.type === 'openai' && (
                        <div>
                            <label className="block text-sm font-bold mb-2 text-gray-500">API Endpoint</label>
                            <input value={editingAiConfig.baseUrl} onChange={e=>setEditingAiConfig({...editingAiConfig, baseUrl:e.target.value})} placeholder="https://api.openai.com/v1" className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none font-mono text-sm"/>
                        </div>
                    )}
                    
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-gray-500">API 密钥来源</label>
                            <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                                <button onClick={() => setAiKeySource('manual')} className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all", aiKeySource === 'manual' ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600" : "text-gray-400 hover:text-gray-600")}>手动输入</button>
                                <button onClick={() => setAiKeySource('env')} className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all", aiKeySource === 'env' ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600" : "text-gray-400 hover:text-gray-600")}>环境变量</button>
                            </div>
                        </div>
                        
                        {aiKeySource === 'env' ? (
                            <div className="relative group">
                                <select 
                                    value={editingAiConfig.envSlot || 'API_KEY'} 
                                    onChange={e => setEditingAiConfig({...editingAiConfig, envSlot: e.target.value, apiKey: ''})}
                                    className="w-full p-3 pl-4 pr-10 rounded-xl border-2 border-violet-100 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-900/10 text-violet-700 dark:text-violet-300 outline-none appearance-none font-mono text-sm font-bold cursor-pointer transition-all hover:border-violet-300"
                                >
                                    <option value="API_KEY">默认 (API_KEY)</option>
                                    {[1,2,3,4,5].map(i => (
                                        <option key={i} value={`CUSTOM_API_KEY_${i}`}>CUSTOM_API_KEY_{i}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-3.5 text-violet-500 pointer-events-none group-hover:translate-y-0.5 transition-transform"><ChevronDown size={16}/></div>
                            </div>
                        ) : (
                            <input type="password" value={editingAiConfig.apiKey} onChange={e=>setEditingAiConfig({...editingAiConfig, apiKey:e.target.value, envSlot: undefined})} placeholder="sk-..." className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none font-mono text-sm"/>
                        )}
                        {aiKeySource === 'env' && <p className="text-xs text-gray-400 mt-2 ml-1">请确保在 Vercel 环境变量中已配置对应的 Key。</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-2 text-gray-500">模型名称</label>
                        <input value={editingAiConfig.model} onChange={e=>setEditingAiConfig({...editingAiConfig, model:e.target.value})} placeholder="gpt-4o / gemini-2.5-flash" className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none font-mono text-sm"/>
                    </div>
                    <div className="flex gap-2 pt-4">
                        <button onClick={() => handleTestConnection(editingAiConfig)} disabled={testStatus.status === 'loading'} className={cn("px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border shadow-sm", testStatus.status === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-600" : testStatus.status === 'fail' ? "bg-red-50 border-red-200 text-red-600" : "bg-white dark:bg-slate-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50")}>
                            {testStatus.status === 'loading' ? <LoadingSpinner/> : testStatus.status === 'success' ? <CircleCheck size={16}/> : testStatus.status === 'fail' ? <TriangleAlert size={16}/> : <Activity size={16}/>}
                            {testStatus.status === 'loading' ? '测试中' : '检测'}
                        </button>
                        <button onClick={async () => {
                             let newConfigs = settings.aiConfigs.map(c => c.id === editingAiConfig.id ? editingAiConfig : c);
                             if (editingAiConfig.id.startsWith('ai-') && !settings.aiConfigs.find(c => c.id === editingAiConfig.id)) {
                                 newConfigs = [...settings.aiConfigs.filter(c => c.id !== editingAiConfig.id), editingAiConfig];
                             }
                             const newSettings = { ...settings, aiConfigs: newConfigs };
                             setLocalSettings(newSettings);
                             await saveSettings(newSettings);
                             setEditingAiConfig(null);
                        }} className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 shadow-lg shadow-violet-500/30">保存配置</button>
                    </div>
                    {testStatus.message && <div className={cn("text-xs text-center font-medium mt-1", testStatus.status === 'success' ? "text-emerald-500" : testStatus.status === 'fail' ? "text-red-500" : "text-gray-400")}>{testStatus.message}</div>}
                    
                    <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700 flex justify-center">
                        <button onClick={() => handleDeleteAiProvider(editingAiConfig.id)} className="text-red-400 hover:text-red-600 text-xs font-bold flex items-center gap-1 transition-colors"><Trash2 size={12}/> 删除此配置</button>
                    </div>
                </div>
            </Modal>
      )}

      {editingLink && (
        <Modal 
          title={editingLink.link ? "编辑链接" : "添加链接"} 
          onClose={() => { setEditingLink(null); setLinkForm({}); }}
          icon={<LinkIcon size={20}/>}
        >
          <div className="p-6 space-y-4">
             <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">URL 链接</label>
                <div className="flex gap-2">
                    <input 
                      value={linkForm.url || ''} 
                      onChange={e => setLinkForm({...linkForm, url: e.target.value})} 
                      placeholder="https://example.com" 
                      className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none"
                    />
                    <button onClick={handleAiFillLink} disabled={isAiLoading} className="px-3 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 rounded-xl font-bold text-xs flex items-center gap-1 hover:bg-violet-200">
                        {isAiLoading ? <LoadingSpinner/> : <Wand2 size={14}/>} AI 填充
                    </button>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-gray-500 mb-1">标题</label>
                    <input 
                      value={linkForm.title || ''} 
                      onChange={e => setLinkForm({...linkForm, title: e.target.value})} 
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-500 mb-1">描述 (可选)</label>
                    <input 
                      value={linkForm.description || ''} 
                      onChange={e => setLinkForm({...linkForm, description: e.target.value})} 
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none"
                    />
                 </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-emerald-500 mb-1">优点标签 (4-8字)</label>
                    <input 
                      value={linkForm.pros || ''} 
                      onChange={e => setLinkForm({...linkForm, pros: e.target.value})} 
                      placeholder="e.g. 完全免费"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-rose-500 mb-1">缺点标签 (4-8字)</label>
                    <input 
                      value={linkForm.cons || ''} 
                      onChange={e => setLinkForm({...linkForm, cons: e.target.value})} 
                      placeholder="e.g. 需注册"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 outline-none"
                    />
                 </div>
             </div>

             <button onClick={handleSaveLink} className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 shadow-lg shadow-violet-500/20">保存</button>
          </div>
        </Modal>
      )}

      {showGenLinksModal && (
        <Modal 
          title={`AI 智能推荐: ${showGenLinksModal.title}`} 
          onClose={() => setShowGenLinksModal(null)} 
          icon={<Wand2 size={20}/>}
        >
           <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-violet-50 dark:bg-violet-900/10 rounded-xl border border-violet-100 dark:border-violet-900/20">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-violet-600 shadow-sm"><Bot size={24}/></div>
                  <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">AI 将为您搜索并推荐相关网站</p>
                      <p className="text-xs text-gray-500 mt-0.5">自动过滤已存在的链接，并尝试获取最新 Favicon。</p>
                  </div>
              </div>
              
              <div>
                  <label className="block text-sm font-bold text-gray-500 mb-3">生成数量</label>
                  <div className="flex gap-3">
                      {[2, 4, 6, 8].map(num => (
                          <button 
                            key={num}
                            onClick={() => setGenCount(num)}
                            className={cn("flex-1 py-3 rounded-xl font-bold border transition-all", genCount === num ? "bg-violet-600 text-white border-violet-600" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 hover:border-violet-500")}
                          >
                              {num} 个
                          </button>
                      ))}
                  </div>
              </div>

              <button 
                onClick={handleGenerateCategoryLinks} 
                disabled={isGeneratingLinks}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-violet-500/30 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
              >
                  {isGeneratingLinks ? <><LoadingSpinner/> 正在思考中...</> : <><Wand2 size={18}/> 开始生成</>}
              </button>
           </div>
        </Modal>
      )}
      </div>
  );
};
