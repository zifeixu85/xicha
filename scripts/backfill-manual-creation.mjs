import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { createServer } from "node:http";
import { importDrinkCreation } from "../server/creation-store.mjs";

export const backfillManualCreation = async ({ email, drink, blessing, moodNote = "", media }) => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const normalizedEmail = String(email || "").trim();
  const users = normalizedEmail
    ? await sql.query('SELECT id FROM neon_auth."user" WHERE lower(email) = lower($1) LIMIT 2', [normalizedEmail])
    : await sql.query('SELECT id FROM neon_auth."user" ORDER BY "createdAt" DESC LIMIT 2');
  if (users.length !== 1) throw new Error("Could not resolve exactly one Neon account for this backfill");
  return importDrinkCreation({
    ownerId: users[0].id,
    drink,
    blessing,
    moodNote,
    media,
  });
};

if (process.argv.includes("--listen-once")) {
  const port = Number(process.env.BACKFILL_BRIDGE_PORT) || 43127;
  const server = createServer((request, response) => {
    if (request.socket.remoteAddress !== "127.0.0.1" && request.socket.remoteAddress !== "::ffff:127.0.0.1") {
      response.writeHead(403).end();
      return;
    }
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 32 * 1024) request.destroy();
      else chunks.push(chunk);
    });
    request.on("end", async () => {
      try {
        const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const result = await backfillManualCreation(input);
        response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify({ saved: true, id: result.id, media: Object.keys(result.media) }));
      } catch (error) {
        response.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ saved: false, error: error.message }));
      } finally {
        server.close();
      }
    });
  });
  server.listen(port, "127.0.0.1", () => console.log(`Backfill bridge ready on 127.0.0.1:${port}`));
}
