// Fixture: an API root whose graph reaches collector-only code indirectly
// (api.module -> companies -> news). The boundary rule must reject it.
import { companiesModuleName } from './companies/companies.module';
import { healthModuleName } from './health/health.module';

export const apiModuleImports: readonly string[] = [companiesModuleName, healthModuleName];
