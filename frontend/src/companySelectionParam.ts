/**
 * The Companies page keeps the company open in its edit panel in the URL
 * (`/companies?company=<id>`), so the panel survives reloads and other pages
 * (the company detail panel, #14) can link straight to a company's profile.
 */
export const COMPANY_PARAM = 'company';

/** The Tracked Company id in the parameter, or null when it is missing or not a positive integer. */
export function parseCompanyId(value: string | null): number | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** `current` with the parameter set to `id`, or removed for null; every other parameter is kept. */
export function withCompanyId(current: URLSearchParams, id: number | null): URLSearchParams {
  const next = new URLSearchParams(current);
  if (id === null) next.delete(COMPANY_PARAM);
  else next.set(COMPANY_PARAM, String(id));
  return next;
}
