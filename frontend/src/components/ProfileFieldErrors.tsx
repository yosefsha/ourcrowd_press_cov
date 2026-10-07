interface Props {
  id: string;
  errors?: readonly string[] | undefined;
}

/** The server's validation messages for one form field, referenced by the field's aria-describedby. */
export function ProfileFieldErrors({ id, errors }: Props): React.JSX.Element | null {
  if (errors === undefined || errors.length === 0) return null;
  return (
    <span id={id} style={{ display: 'flex', flexDirection: 'column', fontSize: 13, color: '#ab091e' }}>
      {errors.map((message) => (
        <span key={message}>{message}</span>
      ))}
    </span>
  );
}
