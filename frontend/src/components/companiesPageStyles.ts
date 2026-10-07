/** Shared inline styles for the Companies page and the components only it uses. */

export const primaryButtonStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #2251b0',
  borderRadius: 4,
  background: '#2f6fde',
  color: '#ffffff',
  cursor: 'pointer',
};

export const secondaryButtonStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #bcccdc',
  borderRadius: 4,
  background: '#ffffff',
  color: '#243b53',
  cursor: 'pointer',
};

export const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  border: '1px solid #ab091e',
  color: '#ab091e',
};
