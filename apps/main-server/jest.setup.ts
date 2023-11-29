import * as dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const myEnv = dotenv.config({ path: 'apps/main-server/.env.test' });
dotenvExpand.expand(myEnv);
