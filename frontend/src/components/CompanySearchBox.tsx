import { useEffect, useId, useState } from 'react';

interface Props {
  /** The search currently applied to the table. */
  value: string;
  onSearch: (q: string) => void;
}

/** Typing pauses this long before the search is applied, so each keystroke is not a request. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Company name search; applies what was typed once typing pauses. */
export function CompanySearchBox({ value, onSearch }: Props): React.JSX.Element {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [appliedValue, setAppliedValue] = useState(value);

  // The applied search changed (Back, a pasted link, or this box's own debounce): show it,
  // unless the draft already means the same search. Adjusting state while rendering, rather
  // than in an effect, keeps the effect below from re-applying a stale draft.
  if (value !== appliedValue) {
    setAppliedValue(value);
    if (draft.trim() !== value) setDraft(value);
  }

  useEffect(() => {
    if (draft.trim() === value) return undefined;
    const timer = setTimeout(() => {
      onSearch(draft.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, value, onSearch]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor={id} style={{ fontSize: 14 }}>
        Search
      </label>
      <input
        id={id}
        type="search"
        value={draft}
        placeholder="Company name"
        maxLength={100}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        style={{ padding: '4px 8px', fontSize: 14 }}
      />
    </div>
  );
}
