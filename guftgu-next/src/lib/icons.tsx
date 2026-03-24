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
