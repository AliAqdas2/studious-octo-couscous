/**
 * Seed / refresh Client Communication stage catalog (CRM-22).
 * Usage: npm run db:seed-client-comm-stages
 */
import { ensureClientCommStageDefs } from "../server/services/events/clientCommunicationStages.js";

async function main() {
  const result = await ensureClientCommStageDefs();
  console.log(
    `Client communication stage defs upserted (${result.count} catalog entries).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
