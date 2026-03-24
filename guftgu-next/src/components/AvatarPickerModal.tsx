import { useState } from 'react';
import Avatar from './Avatar';
import { AVATAR_CATEGORIES } from './Avatar';
import { S } from '@/lib/strings';

interface AvatarPickerModalProps {
  open: boolean;
  selected: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}

const TABS = [
  { key: 'animal', label: S.modal.avatarTabAnimal },
  { key: 'people', label: S.modal.avatarTabPeople },
  { key: 'fantasy', label: S.modal.avatarTabFantasy },
] as const;

export default function AvatarPickerModal({ open, selected, onSelect, onClose }: AvatarPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'animal' | 'people' | 'fantasy'>('animal');

  const avatars = AVATAR_CATEGORIES[activeTab];

  return (
    <div className={`modal-overlay${open ? ' show' : ''}`} onClick={onClose}>
      <div className="modal-sheet modal-sheet-tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">{S.modal.avatarTitle}</div>
          <button className="modal-close" onClick={onClose}>{S.common.close}</button>
        </div>
        <div className="avatar-picker-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`avatar-picker-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="avatar-picker-scroll">
          <div className="avatar-picker-grid">
            {avatars.map((key) => (
              <div
                key={key}
                className={`avatar-picker-item${selected === key ? ' selected' : ''}`}
                onClick={() => onSelect(key)}
              >
                <Avatar avatarKey={key} size={60} />
                <span className="avatar-picker-item-name">{key}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
