import { useApp } from '@/context/AppContext';

/** Detect toast type from message content */
function getToastType(msg: string): 'success' | 'error' | 'info' {
  if (/✓|✅|🎉|added|unblock|cleared|deleted/i.test(msg)) return 'success';
  if (/❌|fail|error/i.test(msg)) return 'error';
  return 'info';
}

const TOAST_ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export default function Toast() {
  const { state } = useApp();
  const type = getToastType(state.toastMsg);

  return (
    <div className={`toast toast-${type}${state.toastVisible ? ' show' : ''}`}>
      <span className="toast-icon">{TOAST_ICONS[type]}</span>
      <span className="toast-text">{state.toastMsg}</span>
      <div className="toast-progress" />
    </div>
  );
}
