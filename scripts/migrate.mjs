import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("缺少 DATABASE_URL。请先复制 .env.example 为 .env，并填写 Neon pooled connection string。");
  process.exit(1);
}

const migrationUrl = new URL("../migrations/001_user_favorites.sql", import.meta.url);
const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
const statements = migration
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(databaseUrl);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Neon migration complete: ${statements.length} statements applied.`);
