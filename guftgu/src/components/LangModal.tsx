import { LANG_DATA } from '@/lib/data';
import { S } from '@/lib/strings';

interface LangModalProps {
  open: boolean;
  selected: string;
  onSelect: (lang: string) => void;
  onClose: () => void;
}

export default function LangModal({ open, selected, onSelect, onClose }: LangModalProps) {
  return (
    <div className={`modal-overlay${open ? ' show' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">{S.modal.langTitle}</div>
          <button className="modal-close" onClick={onClose}>{S.common.close}</button>
        </div>
        <div id="modalLangGrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, padding: '0 20px 20px' }}>
          {LANG_DATA.map((l) => (
            <div
              key={l.lang}
              className={`lang-pill${selected === l.lang ? ' selected' : ''}`}
              onClick={() => onSelect(l.lang)}
            >
              <span className="lang-flag">{l.flag}</span>
              <span className="lang-name">{l.lang}</span>
              <span className="lang-native">{l.native}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
