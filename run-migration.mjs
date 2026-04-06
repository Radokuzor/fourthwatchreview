import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const sql = `
CREATE TABLE IF NOT EXISTS \`user_audits\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int,
  \`email\` varchar(320),
  \`placeId\` varchar(256) NOT NULL,
  \`businessName\` varchar(255) NOT NULL,
  \`auditJson\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`user_audits_id\` PRIMARY KEY(\`id\`)
);
`;

const conn = await createConnection(process.env.DATABASE_URL);
await conn.execute(sql);
console.log('✅ user_audits table created (or already exists)');
await conn.end();
