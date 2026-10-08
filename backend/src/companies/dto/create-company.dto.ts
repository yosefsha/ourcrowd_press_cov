import type { NewCompanyProfile } from '../companies.service';
import { DescriptionField, DisplayNameField, DomainField, NameListField } from './company-profile-fields';

/**
 * POST /api/admin/companies — a company added by hand. It never has a Source
 * Name: sending one is rejected by the global pipe (`forbidNonWhitelisted`).
 */
export class CreateCompanyDto implements NewCompanyProfile {
  @DisplayNameField(true)
  readonly displayName!: string;

  @NameListField()
  readonly aliases?: string[];

  @DomainField()
  readonly domain?: string | null;

  @DescriptionField()
  readonly description?: string | null;

  @NameListField()
  readonly searchTerms?: string[];
}
