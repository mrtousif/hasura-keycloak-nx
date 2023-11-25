import { Kysely, PostgresDialect } from 'kysely';
import { DB } from 'kysely-codegen';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
  log: ['query', 'error'],
});

const userIds = [...Array(10).keys()].map(() => ({
  id: randomUUID(),
}));

async function main() {
  await db
    .insertInto('users')
    .values(
      userIds.map(({ id }) => ({
        id,
        auth_id: randomUUID(),
        email: faker.internet.email(),
        name: faker.person.fullName(),
        phone: faker.phone.number(),
      }))
    )
    .execute();

  await db
    .insertInto('posts')
    .values(
      userIds.map(({ id }) => ({
        author: id,
        published: faker.datatype.boolean(),
        title: faker.lorem.sentence(),
        content: faker.lorem.sentences(2),
      }))
    )
    .execute();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
