/**
 * Centralized SVG icon components for the Guftgu app.
 * Import from here instead of using inline SVGs.
 *
 * Usage:
 *   import { IconChevronLeft, IconPhone } from '@/lib/icons';
 *   <IconChevronLeft size={18} />
 */
import React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

/* ─── Navigation / Actions ──────────────────────────────── */

/** Back chevron (←) — used on CallScreen, ChatScreen, OnboardScreen, MatchScreen, HistoryScreen, BlockedScreen */
export const IconChevronLeft: React.FC<IconProps> = ({
  size = 18, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} className={className} style={style}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

/** Home icon — used in BottomNav */
export const IconHome: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

/** Users / friends icon — used in BottomNav */
export const IconUsers: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/** Bell / notifications icon — used in BottomNav */
export const IconBell: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

/** Single user / profile icon — used in BottomNav */
export const IconUser: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/* ─── Call Controls ─────────────────────────────────────── */

/** Microphone icon (unmuted) — used on CallScreen */
export const IconMic: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} className={className} style={style}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

/** Microphone-off icon (muted) — used on CallScreen */
export const IconMicOff: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} className={className} style={style}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .97-.2 1.9-.56 2.73" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

/** Phone icon — used on CallScreen (end), ChatScreen (header), HomeScreen (dial) */
export const IconPhone: React.FC<IconProps> = ({
  size = 20, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

/** Phone-end icon (slightly different path) — used on CallScreen end button */
export const IconPhoneEnd: React.FC<IconProps> = ({
  size = 28, color = '#fff', strokeWidth = 2.5, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" className={className} style={style}>
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" />
  </svg>
);

/** Speaker / volume icon — used on CallScreen */
export const IconSpeaker: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} className={className} style={style}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

/** Send / arrow icon — used on ChatScreen */
export const IconSend: React.FC<IconProps> = ({
  size = 20, color = '#fff', strokeWidth = 2.5, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} className={className} style={style}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

/** Block / ban icon — used for blocking users */
export const IconBlock: React.FC<IconProps> = ({
  size = 20, color = '#fff', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} className={className} style={style}>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

/** Clock / history icon — used in BottomNav for History tab */
export const IconClock: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/** Chat bubble icon — used in BottomNav for Chats tab */
export const IconChat: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/** Trash / delete icon — used for deleting chats in NotifsScreen */
export const IconTrash: React.FC<IconProps> = ({
  size = 20, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

/** Alert triangle icon — used for delete account modal in ProfileScreen */
export const IconAlertTriangle: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', strokeWidth = 2, className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/** Unfriend icon — filled person silhouette with minus badge (Flaticon style) */
export const IconUnfriend: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    {/* Filled person head */}
    <circle cx="9" cy="6" r="4" fill={color} />
    {/* Filled person body/shoulders */}
    <path d="M1 20c0-4 3.6-7 8-7s8 3 8 7" fill={color} />
    {/* Minus badge circle */}
    <circle cx="19" cy="6" r="4.5" fill="#e53935" />
    {/* Minus line inside badge */}
    <rect x="16.5" y="5.25" width="5" height="1.5" rx="0.75" fill="#fff" />
  </svg>
);

/** Share icon — arrow pointing out of a box (standard share symbol) */
export const IconShare: React.FC<IconProps> = ({
  size = 22, color = 'currentColor', className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);
