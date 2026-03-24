import { REGION_DATA } from '@/lib/data';
import { S } from '@/lib/strings';

interface RegionModalProps {
  open: boolean;
  selected: string;
  onSelect: (region: string) => void;
  onClose: () => void;
}

export default function RegionModal({ open, selected, onSelect, onClose }: RegionModalProps) {
  return (
    <div className={`modal-overlay${open ? ' show' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">{S.modal.regionTitle}</div>
          <button className="modal-close" onClick={onClose}>{S.common.close}</button>
        </div>
        <div className="region-modal-grid" style={{ padding: '0 20px 20px' }}>
          {REGION_DATA.map((r) => (
            <div
              key={r.region}
              className={`region-card-modal${selected === r.region ? ' selected' : ''}`}
              onClick={() => onSelect(r.region)}
            >
              <div className="r-icon">{r.icon}</div>
              <div className="r-name">{r.name}</div>
              <div className="r-states">{r.states}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
