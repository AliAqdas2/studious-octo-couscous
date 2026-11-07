/**
 * Seed / refresh Client Communication stage catalog.
 * Upserts titles, offsets, scripts, and Cooking simple-track flags.
 * Usage: npm run db:seed-client-comm-stages
 * Prod:  node dist/seed-client-comm-stages.js
 */
import { ensureClientCommStageDefs } from "../server/services/events/clientCommunicationStages.js";
import { COOKING_SIMPLE_COMM_SLUGS } from "../server/services/events/clientCommStageCatalog.js";

async function main() {
  const result = await ensureClientCommStageDefs();
  console.log(
    `Client communication stage defs upserted (${result.count} catalog entries; Cooking simple track = ${COOKING_SIMPLE_COMM_SLUGS.length} steps).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
