
export interface LogEntry {
  id: string;
  time: string;
  level: 'info' | 'error' | 'warn';
  message: string;
}

const logs: LogEntry[] = [];
const listeners: (() => void)[] = [];

const notifyListeners = () => {
  listeners.forEach(l => l());
};

export const addLog = (level: 'info' | 'error' | 'warn', message: any) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const msgStr = typeof message === 'object' 
    ? (message instanceof Error ? message.message : JSON.stringify(message)) 
    : String(message);
    
  logs.unshift({ 
    id: Math.random().toString(36).substr(2, 9),
    time: timestamp, 
    level, 
    message: msgStr 
  });
  
  // Keep limit
  if (logs.length > 100) logs.pop();
  
  // Console mirroring
  if (level === 'error') console.error(message);
  else if (level === 'warn') console.warn(message);
  else console.log(message);

  notifyListeners();
};

export const getLogs = () => [...logs];

export const subscribeLogs = (callback: () => void) => {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx > -1) listeners.splice(idx, 1);
  };
};

export const clearLogs = () => {
    logs.length = 0;
    notifyListeners();
};

// Initialize global error catchers
export const initLogger = () => {
    if (typeof window !== 'undefined') {
        // Prevent duplicate handlers if strict mode runs effect twice
        if ((window as any).__aurora_logger_init) return;
        (window as any).__aurora_logger_init = true;

        window.onerror = (msg, url, lineNo, columnNo, error) => {
            const str = String(msg);
            if (str.includes('ResizeObserver')) return; // Ignore benign ResizeObserver loops
            addLog('error', `系统错误: ${str} (${lineNo}:${columnNo})`);
            return false;
        };

        window.onunhandledrejection = (event) => {
            const reason = event.reason;
            const msg = reason instanceof Error ? reason.message : String(reason);
            addLog('error', `异步异常: ${msg}`);
        };
        
        addLog('info', '系统日志服务已启动');
    }
};
