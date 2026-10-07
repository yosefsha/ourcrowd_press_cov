import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { configuration } from '../config/configuration';
import { buildTypeOrmOptions } from './typeorm-options';

/**
 * Datasource for the TypeORM CLI (`npm run migration:run`,
 * `npm run migration:generate`). The CLI loads the compiled copy from `dist/`,
 * which the runtime image ships so migrations can run as a one-off task.
 */
const dataSource = new DataSource(buildTypeOrmOptions(configuration().database.url));

export default dataSource;
