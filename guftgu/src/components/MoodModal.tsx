import { MOOD_DATA } from '@/lib/data';
import { S } from '@/lib/strings';

interface MoodModalProps {
  open: boolean;
  selected: string;
  onSelect: (mood: string, emoji: string) => void;
  onClose: () => void;
}

export default function MoodModal({ open, selected, onSelect, onClose }: MoodModalProps) {
  return (
    <div className={`modal-overlay${open ? ' show' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">{S.modal.moodTitle}</div>
          <button className="modal-close" onClick={onClose}>{S.common.close}</button>
        </div>
        <div className="modal-body">
          <div className="mood-grid" style={{ padding: '0 20px 3px' }}>
            {MOOD_DATA.map((m) => (
              <div
                key={m.mood}
                className={`mood-card${selected === m.mood ? ' selected' : ''}`}
                onClick={() => onSelect(m.mood, m.emoji)}
              >
                <div className="mood-emoji">{m.emoji}</div>
                <div className="mood-name">{m.mood}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
