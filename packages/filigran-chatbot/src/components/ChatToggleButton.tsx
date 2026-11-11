import { Button } from '@filigran/design-system';
import type { FunctionComponent } from 'react';
import type { ChatToggleButtonProps } from '../types';
import { useMemo } from 'react';
import { createTranslate } from '../i18n';
import { DefaultLogoIcon } from './icons';

/**
 * The host's button that opens and closes the panel: the design system's
 * secondary Button (its border, hover, focus ring and pressed state come from
 * the host's design-system tokens). `accentColor` is no longer painted on it
 * (chatbot 3.23.0): the button follows the design system like every other
 * control of the panel.
 */
export const ChatToggleButton: FunctionComponent<ChatToggleButtonProps> = ({ isOpen, onToggle, label, icon, t: hostT, locale }) => {
  const t = useMemo(() => createTranslate(hostT, locale), [hostT, locale]);
  const resolvedIcon = icon ?? <DefaultLogoIcon size={16} />;

  return (
    <Button
      priority="secondary"
      size="sm"
      aria-pressed={isOpen}
      onClick={onToggle}
      className="filigran-chatbot"
      startIcon={<span className="inline-flex [&>svg]:w-4 [&>svg]:h-4">{resolvedIcon}</span>}
    >
      {label ?? t('Ask Assistant')}
    </Button>
  );
};
