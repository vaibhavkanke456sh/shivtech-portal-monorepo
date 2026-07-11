/**
 * One-shot CLI: settle fully paid task groups whose linked tasks still show unpaid.
 * Usage (from backend/): node scripts/repairFullyPaidGroups.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('Missing MONGO_URI / MONGODB_URI');
  process.exit(1);
}

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Dynamic import after env so models use same connection
  const { runFullGroupPaymentRepair } = await import('../routes/data.js');

  const stats = await runFullGroupPaymentRepair();
  console.log('Repair complete:', stats);

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
