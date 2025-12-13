
import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, className }) => {
  const IconComponent = (LucideIcons as any)[name];

  if (!IconComponent) {
    // Fallback to CircleHelp if the requested icon is not found
    // Uses CircleHelp (new name) or HelpCircle (old name) depending on version availability
    const Fallback = (LucideIcons as any).CircleHelp || (LucideIcons as any).HelpCircle;
    return Fallback ? <Fallback size={size} className={className} /> : null;
  }

  return <IconComponent size={size} className={className} />;
};
