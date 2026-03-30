import { useEffect, useRef } from 'react';
import Avatar from '@/components/Avatar';
import { IconPhone, IconPhoneEnd, IconBlock } from '@/lib/icons';
import { playIncomingRingtone } from '@/lib/sounds';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName: string;
  callerAvatar: string;
  callerMood: string;
  callerMoodEmoji: string;
  onAccept: () => void;
  onDecline: () => void;
  onBlock?: () => void;
}

export default function IncomingCallModal({
  isOpen,
  callerName,
  callerAvatar,
  callerMood,
  callerMoodEmoji,
  onAccept,
  onDecline,
  onBlock,
}: IncomingCallModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone and vibrate when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    // Vibrate if supported
    let vibrateInterval: ReturnType<typeof setInterval> | null = null;
    if (navigator.vibrate) {
      vibrateInterval = setInterval(() => {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }, 1500);
    }

    // Play the musical ringtone from sounds.ts
    const ringtoneHandle = playIncomingRingtone();
    
    return () => {
      ringtoneHandle.stop();
      if (vibrateInterval) clearInterval(vibrateInterval);
      navigator.vibrate?.(0);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        {/* Avatar with animated rings coming from center */}
        <div className="incoming-avatar-container">
          {/* Rings animate outward from avatar */}
          <div className="incoming-ring ring-1" />
          <div className="incoming-ring ring-2" />
          <div className="incoming-ring ring-3" />
          {/* Avatar on top */}
          <div className="incoming-call-avatar">
            <Avatar avatarKey={callerAvatar} size={100} />
          </div>
        </div>

        {/* Caller info */}
        <div className="incoming-call-info">
          <div className="incoming-call-label">📞 Incoming Call</div>
          <div className="incoming-call-name">{callerName || 'Unknown'}</div>
          {(callerMood || callerMoodEmoji) && (
            <div className="incoming-call-mood">{callerMoodEmoji} {callerMood}</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="incoming-call-actions">
          <button className="incoming-btn decline" onClick={onDecline}>
            <div className="incoming-btn-icon">
              <IconPhoneEnd size={28} />
            </div>
            <span>Decline</span>
          </button>
          <button className="incoming-btn accept" onClick={onAccept}>
            <div className="incoming-btn-icon">
              <IconPhone size={28} />
            </div>
            <span>Accept</span>
          </button>
        </div>

        {/* Block option */}
        {onBlock && (
          <button className="incoming-block-btn" onClick={onBlock}>
            <IconBlock size={16} color="#FF6B6B" />
            <span>Block caller</span>
          </button>
        )}
      </div>
    </div>
  );
}
