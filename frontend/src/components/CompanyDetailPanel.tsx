import type { CoverageWindow } from '../types.ts';

interface Props {
  companyId: number;
  coverageWindow: CoverageWindow;
  onClose: () => void;
}

/**
 * Detail panel for one Tracked Company. Placeholder until #14 implements it;
 * the props are the contract the Overview page (#13) renders it with.
 */
export function CompanyDetailPanel(_props: Props): React.JSX.Element | null {
  return null;
}
