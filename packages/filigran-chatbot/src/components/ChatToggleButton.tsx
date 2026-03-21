import type { FunctionComponent } from 'react';
import type { ChatToggleButtonProps } from '../types';
import { hexAlpha } from '../utils';
import { DefaultLogoIcon } from './icons';

export const ChatToggleButton: FunctionComponent<ChatToggleButtonProps> = ({ isOpen, onToggle, label = 'Ask Assistant', accentColor = '#7b5cff', icon }) => {
  const resolvedIcon = icon ?? <DefaultLogoIcon size={16} />;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="filigran-chatbot inline-flex items-center gap-1.5 px-3 py-[3px] text-[0.8125rem] font-medium whitespace-nowrap rounded-md border transition-colors"
      style={{
        borderColor: isOpen ? accentColor : hexAlpha(accentColor, 0.5),
        color: accentColor,
        backgroundColor: isOpen ? hexAlpha(accentColor, 0.1) : 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accentColor;
        e.currentTarget.style.backgroundColor = hexAlpha(accentColor, 0.1);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isOpen ? accentColor : hexAlpha(accentColor, 0.5);
        e.currentTarget.style.backgroundColor = isOpen ? hexAlpha(accentColor, 0.1) : 'transparent';
      }}
    >
      <span className="[&>svg]:w-4 [&>svg]:h-4">{resolvedIcon}</span>
      {label}
    </button>
  );
};
