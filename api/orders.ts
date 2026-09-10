import fs from "fs";
import path from "path";
import { getDbModule } from "./_db_helper";

const ORDERS_FILE = path.join(process.cwd(), "orders.json");
const TMP_ORDERS_FILE = path.join("/tmp", "orders.json");
const DELETED_ORDERS_FILE = path.join(process.cwd(), "deleted_orders.json");
const TMP_DELETED_ORDERS_FILE = path.join("/tmp", "deleted_orders.json");

function readOrdersFromFile(): any[] {
  try {
    if (fs.existsSync(TMP_ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_ORDERS_FILE, "utf8"));
    }
    if (fs.existsSync(ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("[api/orders.ts] Error reading orders from file:", e);
  }
  return [];
}

function writeOrdersToFile(orders: any[]) {
  try {
    fs.writeFileSync(TMP_ORDERS_FILE, JSON.stringify(orders));
  } catch (e) {}
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders));
  } catch (e) {}
}

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

function writeDeletedOrdersToFile(deletedIds: string[]) {
  try {
    fs.writeFileSync(TMP_DELETED_ORDERS_FILE, JSON.stringify(deletedIds));
  } catch (e) {}
  try {
    fs.writeFileSync(DELETED_ORDERS_FILE, JSON.stringify(deletedIds));
  } catch (e) {}
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = await getDbModule();

    if (db.isPostgresActive()) {
      await db.initDb().catch(() => {});
    }

    if (req.method === "GET") {
      let orders: any[] = [];
      if (db.isPostgresActive()) {
        try {
          orders = await db.getOrdersFromDb();
        } catch (e) {
          console.error("[Vercel orders.ts] Error reading from DB:", e);
        }
      }
      if (!orders || orders.length === 0) {
        orders = readOrdersFromFile();
      }

      let deletedIds: string[] = [];
      if (db.isPostgresActive()) {
        try {
          deletedIds = await db.getDeletedOrderIdsFromDb();
        } catch (e) {}
      }
      if (!deletedIds || deletedIds.length === 0) {
        deletedIds = readDeletedOrdersFromFile();
      }

      const deletedSet = new Set(deletedIds);
      const cleanOrders = orders.filter((o: any) => !deletedSet.has(o.id));

      return res.status(200).json(cleanOrders);
    }

    if (req.method === "POST") {
      const { orders: incomingOrders } = req.body || {};
      const rawOrders = Array.isArray(incomingOrders) ? incomingOrders : (Array.isArray(req.body) ? req.body : []);

      let deletedIds: string[] = [];
      if (db.isPostgresActive()) {
        try {
          deletedIds = await db.getDeletedOrderIdsFromDb();
        } catch (e) {}
      }
      if (!deletedIds || deletedIds.length === 0) {
        deletedIds = readDeletedOrdersFromFile();
      }
      const deletedSet = new Set(deletedIds);
      const ordersToSave = rawOrders.filter((o: any) => o && o.id && !deletedSet.has(o.id));

      if (ordersToSave.length > 0 && db.isPostgresActive()) {
        try {
          await db.saveMultipleOrdersToDb(ordersToSave);
        } catch (e) {
          console.error("[Vercel orders.ts] Error writing to DB:", e);
        }
      }

      let currentDbOrders: any[] = ordersToSave;
      if (db.isPostgresActive()) {
        try {
          const fresh = await db.getOrdersFromDb();
          if (fresh && fresh.length > 0) {
            currentDbOrders = fresh;
          }
        } catch (e) {}
      }

      if (!currentDbOrders || currentDbOrders.length === 0) {
        currentDbOrders = readOrdersFromFile();
      } else {
        writeOrdersToFile(currentDbOrders);
      }

      const cleanDbOrders = (currentDbOrders || []).filter((o: any) => o && o.id && !deletedSet.has(o.id));
      return res.status(200).json(cleanDbOrders);
    }

    if (req.method === "DELETE") {
      let id = req.query?.id || req.body?.id;
      if (!id && req.url) {
        const parts = req.url.split("?")[0].split("/");
        const last = parts[parts.length - 1];
        if (last && last !== "orders") {
          id = last;
        }
      }

      if (!id) {
        return res.status(400).json({ error: "Order id is required" });
      }

      if (db.isPostgresActive()) {
        try {
          await db.deleteOrderInDb(id);
        } catch (e) {}
      }

      const existingDeleted = readDeletedOrdersFromFile();
      if (!existingDeleted.includes(id)) {
        existingDeleted.push(id);
        writeDeletedOrdersToFile(existingDeleted);
      }

      const currentOrders = readOrdersFromFile();
      const updated = currentOrders.filter((o: any) => o.id !== id);
      writeOrdersToFile(updated);

      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[Vercel orders.ts] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
