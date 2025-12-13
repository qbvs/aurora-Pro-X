
import { Category, AppSettings, SearchEngine, AIProviderConfig } from './types';

export const INITIAL_SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'se-google',
    name: 'Google',
    baseUrl: 'https://www.google.com',
    searchUrlPattern: 'https://www.google.com/search?q='
  },
  {
    id: 'se-baidu',
    name: 'Baidu',
    baseUrl: 'https://www.baidu.com',
    searchUrlPattern: 'https://www.baidu.com/s?wd='
  },
  {
    id: 'se-bing',
    name: 'Bing',
    baseUrl: 'https://www.bing.com',
    searchUrlPattern: 'https://www.bing.com/search?q='
  }
];

const DEFAULT_AI_CONFIGS: AIProviderConfig[] = [
  {
    id: 'ai-google-env',
    name: 'Google Gemini (Env)',
    type: 'google',
    baseUrl: '', // Not used for SDK
    apiKey: '', // Will use process.env.API_KEY if empty
    model: 'gemini-2.5-flash',
    isActive: true
  },
  {
    id: 'ai-longcat',
    name: '美团龙猫 (Longcat)',
    type: 'openai',
    baseUrl: 'https://api.longcat.chat/openai',
    apiKey: '', // User needs to fill this
    model: 'longcat-flash',
    isActive: false
  }
];

export const INITIAL_SETTINGS: AppSettings = {
  appName: 'Aurora Pro',
  appIcon: 'Zap',
  logoMode: 'icon',
  theme: 'system',
  openInNewTab: true,
  activeSearchEngineId: 'se-google',
  aiConfigs: DEFAULT_AI_CONFIGS,
  cardOpacity: 80,
  backgroundMode: 'aurora',
  backgroundBlur: 0,
  backgroundMaskOpacity: 0,
  enableAiGreeting: true,
  footerHtml: '© 2024 Aurora Pro Navigation. Designed for Geeks.',
  socialLinks: [
      { id: 'sl-1', platform: 'GitHub', url: 'https://github.com', icon: 'Github' },
      { id: 'sl-2', platform: 'Email', url: 'mailto:hello@example.com', icon: 'Mail' }
  ]
};

export const INITIAL_DATA: Category[] = [
  {
    id: 'rec-1',
    title: '常用推荐',
    icon: 'Flame',
    links: [
      {
        id: 'l-1',
        title: 'GitHub',
        url: 'https://github.com',
        description: '代码托管平台',
        color: '#181717',
        clickCount: 10,
        pros: '开源社区',
        cons: '门槛较高'
      },
      {
        id: 'l-2',
        title: 'ChatGPT',
        url: 'https://chat.openai.com',
        description: 'AI 助手',
        color: '#10A37F',
        clickCount: 8,
        pros: '智能强大',
        cons: '需魔法'
      },
      {
        id: 'l-3',
        title: 'Vercel',
        url: 'https://vercel.com',
        description: '前端部署神器',
        color: '#000000',
        clickCount: 6,
        pros: '免费额度',
        cons: '国内稍慢'
      },
      {
        id: 'l-4',
        title: 'YouTube',
        url: 'https://youtube.com',
        description: '视频娱乐',
        color: '#FF0000',
        clickCount: 5,
        pros: '内容丰富',
        cons: '广告多'
      },
    ],
  },
  {
    id: 'dev-1',
    title: '开发工具',
    icon: 'Laptop',
    links: [
      {
        id: 'l-5',
        title: 'Stack Overflow',
        url: 'https://stackoverflow.com',
        description: '技术问答',
        color: '#F48024',
        clickCount: 2
      },
      {
        id: 'l-6',
        title: 'Tailwind CSS',
        url: 'https://tailwindcss.com',
        description: '原子化 CSS 框架',
        color: '#38B2AC',
        clickCount: 1
      },
      {
        id: 'l-7',
        title: 'React Docs',
        url: 'https://react.dev',
        description: 'React 官方文档',
        color: '#61DAFB',
        clickCount: 0
      },
    ],
  },
  {
    id: 'design-1',
    title: '设计灵感',
    icon: 'Palette',
    links: [
        {
            id: 'l-8',
            title: 'Dribbble',
            url: 'https://dribbble.com',
            description: '设计作品分享',
            color: '#EA4C89',
            clickCount: 0
        }
    ]
  }
];
