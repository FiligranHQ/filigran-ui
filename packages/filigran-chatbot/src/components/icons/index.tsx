import { Icon, type IconName, type IconSize } from '@filigran/design-system';

import type { IconProps } from '../../types';

/*
 * Every glyph of the panel comes from @filigran/design-system: its <Icon name>
 * vocabulary (ICON_NAMES), its three designed sizes and currentColor. These
 * named components only keep the call sites readable; none draws its own SVG
 * (the guard in icons.test.tsx fails on an inline SVG drawing anywhere in the package,
 * save the documented exceptions it lists).
 */

/** The design system draws 16, 20 and 24 px only: a requested size snaps to the nearest one. */
export const snapIconSize = (size: number | undefined): IconSize => {
  if (size === undefined) return 24;
  if (size <= 17) return 16;
  if (size <= 21) return 20;
  return 24;
};

type FillableIconProps = IconProps & { filled?: boolean };

const dsIcon = (name: IconName) => {
  const Component = ({ className, size, filled = false }: FillableIconProps) => (
    <Icon name={name} size={snapIconSize(size)} className={[filled ? 'fill-current' : '', className ?? ''].filter(Boolean).join(' ') || undefined} />
  );
  Component.displayName = `Icon(${name})`;
  return Component;
};

export const AlertTriangleIcon = dsIcon('triangle-alert');
export const ArrowRightLeftIcon = dsIcon('arrow-right-left');
export const AttachFileIcon = dsIcon('paperclip');
export const BotIcon = dsIcon('bot');
export const BrainIcon = dsIcon('brain');
export const CheckCircleIcon = dsIcon('circle-check');
export const CheckIcon = dsIcon('check');
export const ChevronDownIcon = dsIcon('chevron-down');
export const ChevronRightIcon = dsIcon('chevron-right');
export const ClapperboardIcon = dsIcon('clapperboard');
export const CloseIcon = dsIcon('x');
export const CopyIcon = dsIcon('copy');
export const DatabaseIcon = dsIcon('database');
/** The chat's default mark (a host passes its brand logo through `logoIcon`). */
export const DefaultLogoIcon = dsIcon('sparkle');
export const DownloadIcon = dsIcon('download');
export const EditIcon = dsIcon('square-pen');
export const ExternalLinkIcon = dsIcon('external-link');
export const FileIcon = dsIcon('file');
export const FileTextIcon = dsIcon('file-text');
export const FloatingIcon = dsIcon('picture-in-picture-2');
export const FolderIcon = dsIcon('folder');
export const FolderInputIcon = dsIcon('folder-input');
export const FolderPlusIcon = dsIcon('folder-plus');
export const FullscreenExitIcon = dsIcon('minimize');
export const FullscreenIcon = dsIcon('expand');
export const GamepadIcon = dsIcon('gamepad-2');
export const GlobeIcon = dsIcon('earth');
export const HistoryIcon = dsIcon('history');
export const ImageIcon = dsIcon('image');
export const InfoIcon = dsIcon('info');
export const MailIcon = dsIcon('mail');
export const MaximizeIcon = dsIcon('maximize-2');
export const MessageSquareIcon = dsIcon('message-square');
export const MicIcon = dsIcon('mic');
export const MicOffIcon = dsIcon('mic-off');
export const MoreIcon = dsIcon('ellipsis-vertical');
export const PencilIcon = dsIcon('pencil');
export const PhoneOffIcon = dsIcon('phone-off');
export const PinIcon = dsIcon('pin');
export const PinOffIcon = dsIcon('pin-off');
export const PresentationIcon = dsIcon('presentation');
export const SearchIcon = dsIcon('search');
export const SendIcon = dsIcon('send');
export const SidebarIcon = dsIcon('panel-left-open');
export const SparklesIcon = dsIcon('sparkles');
export const StopCircleIcon = dsIcon('circle-stop');
export const TerminalIcon = dsIcon('terminal');
export const ThumbsDownIcon = dsIcon('thumbs-down');
export const ThumbsUpIcon = dsIcon('thumbs-up');
export const TrashIcon = dsIcon('trash-2');
export const UserPlusIcon = dsIcon('user-plus');
export const VolumeIcon = dsIcon('volume-2');
export const VolumeOffIcon = dsIcon('volume-x');
export const WrenchIcon = dsIcon('wrench');
export const XCircleIcon = dsIcon('circle-x');
