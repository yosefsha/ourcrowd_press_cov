import { DuplicateTrackedCompany, TrackedCompanyNotFound } from './tracked-company.repository';

describe('Tracked Company repository errors', () => {
  it('TrackedCompanyNotFound names the id', () => {
    const error = new TrackedCompanyNotFound(42);

    expect(error.name).toBe('TrackedCompanyNotFound');
    expect(error.id).toBe(42);
    expect(error.message).toContain('42');
  });

  it('DuplicateTrackedCompany names the clashing field and value', () => {
    const error = new DuplicateTrackedCompany('displayName', 'Harvey');

    expect(error.name).toBe('DuplicateTrackedCompany');
    expect(error.field).toBe('displayName');
    expect(error.message).toContain('"Harvey"');
  });
});
