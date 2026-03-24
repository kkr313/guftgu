import { REGION_DATA } from '@/lib/data';
import { S } from '@/lib/strings';

interface RegionModalProps {
  open: boolean;
  selected: string;
  onSelect: (region: string) => void;
  onClose: () => void;
}

// Position map: clock positions for 6 regions around the India center
const REGION_POSITIONS = ['top', 'bottom', 'br', 'tl', 'bl', 'tr'] as const;

export default function RegionModal({ open, selected, onSelect, onClose }: RegionModalProps) {
  const selectedData = REGION_DATA.find((r) => r.region === selected);
  
  return (
    <div className={`modal-overlay${open ? ' show' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">{S.modal.regionTitle}</div>
          <button className="modal-close" onClick={onClose}>{S.common.close}</button>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <div className="region-orbit-wrap">
            <div className="region-orbit">
              {/* India center */}
              <div className="region-center">
                <div className="region-center-flag">🇮🇳</div>
                <div className="region-center-label">India</div>
              </div>
              {/* 6 region nodes */}
              {REGION_DATA.map((r, i) => (
                <div
                  key={r.region}
                  className={`region-node${selected === r.region ? ' selected' : ''}`}
                  data-pos={REGION_POSITIONS[i]}
                  onClick={() => onSelect(r.region)}
                >
                  <div className="region-icon">{r.icon}</div>
                  <div className="region-name">{r.name}</div>
                </div>
              ))}
            </div>
            {/* Selected region states caption */}
            {selectedData && (
              <div className="region-states-caption" key={selected}>
                <span className="region-states-icon">{selectedData.icon}</span>
                <span className="region-states-text">{selectedData.states}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
