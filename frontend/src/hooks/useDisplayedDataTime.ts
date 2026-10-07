import { useState } from 'react';

/**
 * When the rows on screen were fetched, as the reference time for "3 days ago"
 * labels. While a changed query shows the previous rows as placeholder data its
 * `dataUpdatedAt` is 0, so the time of the rows still displayed is kept instead.
 */
export function useDisplayedDataTime(dataUpdatedAt: number, isPlaceholderData: boolean): Date {
  const [displayedAt, setDisplayedAt] = useState(() => (dataUpdatedAt > 0 ? dataUpdatedAt : Date.now()));
  // Adjusting state while rendering (not in an effect) so a fresh fetch never renders with a stale time.
  if (!isPlaceholderData && dataUpdatedAt > 0 && dataUpdatedAt !== displayedAt) {
    setDisplayedAt(dataUpdatedAt);
  }
  return new Date(!isPlaceholderData && dataUpdatedAt > 0 ? dataUpdatedAt : displayedAt);
}
