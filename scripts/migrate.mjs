import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("缺少 DATABASE_URL。请先复制 .env.example 为 .env，并填写 Neon pooled connection string。");
  process.exit(1);
}

const sql = neon(databaseUrl);
const migrationsUrl = new URL("../migrations/", import.meta.url);
const migrationNames = (await readdir(fileURLToPath(migrationsUrl)))
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
let applied = 0;

for (const name of migrationNames) {
  const migration = await readFile(fileURLToPath(new URL(name, migrationsUrl)), "utf8");
  const statements = migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sql.query(statement);
    applied += 1;
  }
}

console.log(`Neon migration complete: ${migrationNames.length} files, ${applied} statements applied.`);
