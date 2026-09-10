import fs from "fs";
import path from "path";
import { getDbModule } from "./_db_helper";

const DELETED_ORDERS_FILE = path.join(process.cwd(), "deleted_orders.json");
const TMP_DELETED_ORDERS_FILE = path.join("/tmp", "deleted_orders.json");

function readDeletedOrdersFromFile(): string[] {
  try {
    if (fs.existsSync(TMP_DELETED_ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_DELETED_ORDERS_FILE, "utf8"));
    }
    if (fs.existsSync(DELETED_ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(DELETED_ORDERS_FILE, "utf8"));
    }
  } catch (e) {}
  return [];
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = await getDbModule();

    let deletedIds: string[] = [];
    if (db.isPostgresActive()) {
      try {
        await db.initDb().catch(() => {});
        deletedIds = await db.getDeletedOrderIdsFromDb();
      } catch (e) {}
    }

    if (!deletedIds || deletedIds.length === 0) {
      deletedIds = readDeletedOrdersFromFile();
    }

    return res.status(200).json(deletedIds || []);
  } catch (err: any) {
    console.error("[Vercel deleted-orders.ts] Error:", err);
    return res.status(200).json([]);
  }
}
