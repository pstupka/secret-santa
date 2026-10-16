import Joi from 'joi';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPackage } from '@core/utils/package';

// All env variables used by the app should be defined in this file.

// To define new env:
// 1. Add env variable to .env.local file;
// 2. Provide validation rules for your env in envsSchema;
// 3. Make it visible outside of this module in export section;
// 4. Access your env variable only via config file.
// Do not use process.env object outside of this file.

const envsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid('production', 'integration', 'development')
      .required(),
    PORT: Joi.number().default(8080),
    PUBLIC_URL: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .required()
      .description('Origin used to build personal links in emails'),
    DATABASE_PATH: Joi.string().required(),
    SMTP_URL: Joi.string()
      .uri({ scheme: ['smtp', 'smtps'] })
      .required(),
    MAIL_FROM: Joi.string().required(),
    CLIENT_DIST_PATH: Joi.string()
      .optional()
      .description('Built client to serve; defaults to client/dist'),
    BACKUP_DIR: Joi.string()
      .allow('')
      .optional()
      .description(
        'Daily snapshots; defaults to backups/ next to the database',
      ),
    BACKUP_RCLONE_REMOTE: Joi.string()
      .allow('')
      .optional()
      .description('rclone destination for offsite copies, e.g. b2:santa'),
    // Only used by protectedByApiKey, which is not mounted on business routes.
    API_KEY_TOKEN: Joi.string().optional(),
  })
  .unknown(true);

const { value: envVars, error } = envsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(
    `Config validation error: ${error.message}. \n
     This app requires env variables to work properly. If you run app locally use docker-compose`,
  );
}
const packageData = readPackage(
  fileURLToPath(new URL('../..', import.meta.url)),
  true,
);

// The monorepo's `client/dist`, from both src/config and dist/config.
const defaultClientDistPath = fileURLToPath(
  new URL('../../../client/dist', import.meta.url),
);

// map env vars and make it visible outside module
export default {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  publicUrl: (envVars.PUBLIC_URL as string).replace(/\/+$/, ''),
  databasePath: envVars.DATABASE_PATH as string,
  backupDir:
    (envVars.BACKUP_DIR as string | undefined) ||
    join(dirname(envVars.DATABASE_PATH as string), 'backups'),
  // Empty means no offsite copy.
  backupRcloneRemote:
    (envVars.BACKUP_RCLONE_REMOTE as string | undefined) || undefined,
  smtpUrl: envVars.SMTP_URL as string,
  mailFrom: envVars.MAIL_FROM as string,
  clientDistPath:
    (envVars.CLIENT_DIST_PATH as string | undefined) ?? defaultClientDistPath,
  xApiKey: envVars.API_KEY_TOKEN as string | undefined,
  projectName: packageData.name,
  projectVersion: packageData.version,
};
