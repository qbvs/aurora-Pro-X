
import React from 'react';
import { X, Settings } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ title, onClose, children, icon }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
      <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2.5 text-violet-600 dark:text-violet-400">
          {icon || <Settings size={20} />}
          <h2 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight">{title}</h2>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
        {children}
      </div>
    </div>
  </div>
);
