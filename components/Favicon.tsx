
import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../utils';

interface FaviconProps {
  url: string;
  size?: number;
  className?: string;
  onLoadError?: () => void;
}

export const Favicon: React.FC<FaviconProps> = ({ url, size = 32, className, onLoadError }) => {
  const [imgError, setImgError] = useState(false);

  const getHostname = (link: string) => {
    try {
      return new URL(link).hostname;
    } catch {
      return '';
    }
  };

  const hostname = getHostname(url);
  const letter = hostname ? hostname.charAt(0).toUpperCase() : '?';

  // Google S2 is reliable. If it fails (network error), we treat it as a broken link signal if requested.
  const src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;

  useEffect(() => {
      // Reset error state when url changes
      setImgError(false);
  }, [url]);

  const handleError = () => {
      setImgError(true);
      if (onLoadError) {
          onLoadError();
      }
  };

  if (!hostname) {
    return (
      <div 
        className={cn("bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center shrink-0 text-gray-400", className)}
        style={{ width: size, height: size }}
      >
        <Globe size={size * 0.6} />
      </div>
    );
  }

  if (imgError) {
    // If error occurs, we still render fallback for Edit Mode, 
    // but Parent will likely hide this in View Mode via onLoadError.
    return (
        <div 
            className={cn("rounded-lg flex items-center justify-center shrink-0 font-bold text-white bg-gradient-to-br from-gray-300 to-gray-400 dark:from-slate-600 dark:to-slate-700 shadow-sm cursor-help", className)}
            style={{ width: size, height: size, fontSize: size * 0.5 }}
            title="Logo unavailable"
        >
            {letter}
        </div>
    );
  }

  return (
    <img 
      src={src}
      alt={hostname}
      className={cn("bg-white rounded-lg object-contain shrink-0 shadow-sm", className)}
      style={{ width: size, height: size }}
      onError={handleError}
      loading="lazy"
    />
  );
};
