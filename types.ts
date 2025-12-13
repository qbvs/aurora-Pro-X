
export interface LinkItem {
  id: string;
  title: string;
  url: string;
  description: string;
  color?: string; // Hex code for brand color
  clickCount?: number; // Track usage frequency
  pros?: string; // e.g. "永久免费计划"
  cons?: string; // e.g. "不可商业用"
}

export interface Category {
  id: string;
  title: string;
  icon: string; // Icon name from Lucide
  links: LinkItem[];
}

export interface SearchEngine {
  id: string;
  name: string;
  baseUrl: string; // Used for Favicon
  searchUrlPattern: string; // e.g., https://www.google.com/search?q=
}

export interface AIProviderConfig {
  id: string;
  name: string;
  type: 'google' | 'openai'; // 'google' uses official SDK, 'openai' uses REST API (Longcat, etc.)
  baseUrl: string; // e.g., https://api.longcat.chat/openai
  apiKey: string; // The manual input key (for testing or direct use)
  envSlot?: string; // e.g., 'CUSTOM_API_KEY_1' - if set, prefer this over apiKey
  model: string; // e.g., gemini-2.5-flash or longcat-flash
  isActive: boolean;
}

export interface SocialLink {
  id: string;
  platform: string; // Display Name
  url: string; 
  icon: string; // Lucide Icon Name
  qrCode?: string; // New: Image URL or Base64 for QR Code
}

export interface AppSettings {
  // Identity
  appName: string;
  appIcon: string; // Lucide Icon Name
  logoMode: 'icon' | 'image'; // New: Choose between Lucide Icon or Custom Image
  customLogoUrl?: string; // New: URL or Base64 for custom logo
  userName?: string; // New: Custom greeting name

  // Behavior
  theme: 'light' | 'dark' | 'system';
  openInNewTab: boolean;
  activeSearchEngineId: string;
  
  // AI Settings
  aiConfigs: AIProviderConfig[];

  // Appearance
  cardOpacity: number;
  backgroundMode: 'aurora' | 'monotone' | 'custom';
  customBackgroundImage?: string; // URL or Base64
  backgroundBlur: number; // New: Blur intensity for background
  backgroundMaskOpacity: number; // New: Dark overlay opacity
  enableAiGreeting: boolean;
  
  // Content
  footerHtml?: string; // New: Custom footer content
  socialLinks: SocialLink[]; // New: Social media links
}

export interface AIResponse {
  title: string;
  description: string;
  categorySuggestion?: string;
  brandColor?: string;
  searchUrlPattern?: string; 
  pros?: string;
  cons?: string;
}

export interface LogEntry {
  id: string;
  time: string;
  level: 'info' | 'error' | 'warn';
  message: string;
}
