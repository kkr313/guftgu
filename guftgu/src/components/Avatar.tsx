// Avatar component — renders SVG avatars from the raw data
// We import the AVATAR_SVGS map from avatars-raw.js and use dangerouslySetInnerHTML
// This is safe because the SVG data is static and trusted (our own code).

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - raw JS file without type declarations
import { AVATAR_SVGS } from '@/lib/avatars-raw';

const avatarMap = AVATAR_SVGS as Record<string, string>;

interface AvatarProps {
  avatarKey: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Avatar({ avatarKey, size = 40, className = '', style }: AvatarProps) {
  const svgData = avatarMap[avatarKey] || avatarMap['cat'] || '';

  if (!svgData) {
    return (
      <span className={className} style={{ fontSize: size * 0.7, ...style }}>
        {avatarKey || '🐾'}
      </span>
    );
  }

  return (
    <span
      className={`avatar-wrap ${className}`}
      style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svgData }}
    />
  );
}

// Also export the SVG map for direct use
export function getAvatarSVG(key: string): string {
  return avatarMap[key] || avatarMap['cat'] || '';
}

// List of avatar categories
export const AVATAR_CATEGORIES = {
  animal: ['cat', 'fox', 'wolf', 'panda', 'lion', 'frog', 'owl', 'bear', 'rabbit', 'tiger', 'deer', 'penguin'],
  people: ['coder', 'artist', 'doctor', 'chef', 'musician', 'astronaut', 'teacher', 'student', 'pilot', 'scientist', 'farmer', 'engineer'],
  fantasy: ['wizard', 'fairy', 'vampire', 'genie', 'elf', 'robot', 'alien', 'ninja', 'knight', 'witch', 'angel', 'samurai'],
};
