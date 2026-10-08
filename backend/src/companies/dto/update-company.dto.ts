import type { CompanyProfile } from '../../domain/company';
import { DescriptionField, DisplayNameField, DomainField, NameListField } from './company-profile-fields';

/**
 * PATCH /api/admin/companies/:id — any Company Profile field; the ones left
 * out keep their value. `sourceName` and `status` are not properties, so the
 * global pipe (`forbidNonWhitelisted`) answers 400 when either is sent.
 */
export class UpdateCompanyDto {
  @DisplayNameField(false)
  readonly displayName?: string;

  @NameListField()
  readonly aliases?: string[];

  @DomainField()
  readonly domain?: string | null;

  @DescriptionField()
  readonly description?: string | null;

  @NameListField()
  readonly searchTerms?: string[];

  /** The fields that were sent, as profile changes. */
  toChanges(): Partial<CompanyProfile> {
    return {
      ...(this.displayName !== undefined && { displayName: this.displayName }),
      ...(this.aliases !== undefined && { aliases: this.aliases }),
      ...(this.domain !== undefined && { domain: this.domain }),
      ...(this.description !== undefined && { description: this.description }),
      ...(this.searchTerms !== undefined && { searchTerms: this.searchTerms }),
    };
  }
}
