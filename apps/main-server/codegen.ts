import type { CodegenConfig } from '@graphql-codegen/cli';
import { cleanEnv, str } from 'envalid';

export const config = cleanEnv(process.env, {
  HASURA_GRAPHQL_API_ENDPOINT: str(),
  HASURA_GRAPHQL_ADMIN_SECRET: str(),
});

const {
  HASURA_GRAPHQL_API_ENDPOINT: endpoint,
  HASURA_GRAPHQL_ADMIN_SECRET: secret,
} = config;

const COMMON_SCALAR_MAPPING = {
  uuid: 'string',
  date: 'string',
  jsonb: 'Record<string, any>',
  timestamptz: 'string',
  timestamp: 'string',
  citext: 'string',
  numeric: 'number',
};

const codeGenConfig: CodegenConfig = {
  generates: {
    'apps/main-server/src/app/sdk/sdk.ts': {
      documents: ['apps/main-server/src/**/*.service.ts'],
      schema: [
        {
          [endpoint]: {
            headers: {
              'x-hasura-admin-secret': secret,
            },
          },
        },
      ],
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        gqlImport: 'graphql-request#gql',
        avoidOptionals: {
          object: true,
          field: true,
          inputValue: false,
        },
        scalars: COMMON_SCALAR_MAPPING,
      },
    },
  },
};

export default codeGenConfig;
