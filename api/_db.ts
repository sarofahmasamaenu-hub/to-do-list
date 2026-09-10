import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

let pool: Pool | null = null;
let isDbConnected = false;

if (connectionString) {
  try {
    const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    const poolConfig: PoolConfig = {
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 20, // Max concurrent connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000, // Fail fast (3s) if network/DNS unreachable
    };

    pool = new Pool(poolConfig);

    pool.on("connect", () => {
      // Client connected to pool
    });

    pool.on("error", (err) => {
      // Suppress noisy idle disconnection logs
      isDbConnected = false;
    });
  } catch (err) {
    console.error("❌ Failed to initialize PostgreSQL pool:", err);
    pool = null;
  }
} else {
  console.log("ℹ️ DATABASE_URL not detected. Server will use local persistent JSON file storage.");
}

/**
 * Initialize PostgreSQL tables automatically if DATABASE_URL is active
 */
export async function initDb(): Promise<boolean> {
  if (!pool) return false;

  try {
    const client = await pool.connect();
    try {
      console.log("🔄 Initializing PostgreSQL database schemas...");

      // 1. Users / Staff Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(100) PRIMARY KEY,
          username VARCHAR(100) UNIQUE,
          password_hash VARCHAR(255),
          name VARCHAR(150) NOT NULL,
          role VARCHAR(50) DEFAULT 'staff',
          branch VARCHAR(100) NOT NULL,
          pin_code VARCHAR(10),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Orders Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(100) PRIMARY KEY,
          order_number VARCHAR(50) UNIQUE NOT NULL,
          customer_name VARCHAR(150) NOT NULL,
          customer_nickname VARCHAR(100),
          customer_phone VARCHAR(50) NOT NULL,
          customer_social VARCHAR(150),
          line_user_id VARCHAR(100),
          dress_type VARCHAR(100) NOT NULL,
          fabric_type VARCHAR(100),
          price NUMERIC(12, 2) DEFAULT 0,
          deposit NUMERIC(12, 2) DEFAULT 0,
          discount NUMERIC(12, 2) DEFAULT 0,
          status VARCHAR(50) DEFAULT 'RECEIVED',
          status_date VARCHAR(50),
          order_date VARCHAR(50),
          delivery_date VARCHAR(50),
          branch VARCHAR(100) NOT NULL,
          staff_name VARCHAR(100),
          tailor_name VARCHAR(100),
          notes TEXT,
          measurements JSONB DEFAULT '{}'::jsonb,
          status_history JSONB DEFAULT '[]'::jsonb,
          reference_images JSONB DEFAULT '[]'::jsonb,
          fitting_images JSONB DEFAULT '[]'::jsonb,
          pickup_signee_name VARCHAR(150),
          pickup_signed_at VARCHAR(100),
          pickup_signature_data TEXT,
          pickup_notes TEXT,
          raw_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at BIGINT DEFAULT 0
        );
      `);

      // 3. Catalogue Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS catalogue (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          dress_type VARCHAR(100),
          price NUMERIC(12, 2) DEFAULT 0,
          fabric VARCHAR(100),
          description TEXT,
          image_url TEXT,
          images JSONB DEFAULT '[]'::jsonb,
          raw_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. Reviews Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS reviews (
          id VARCHAR(100) PRIMARY KEY,
          order_id VARCHAR(100),
          order_number VARCHAR(100),
          customer_name VARCHAR(150),
          dress_type VARCHAR(100),
          rating INT DEFAULT 5,
          comment TEXT,
          reply_comment TEXT,
          status VARCHAR(50) DEFAULT 'approved',
          images JSONB DEFAULT '[]'::jsonb,
          raw_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Store Settings Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS store_settings (
          key VARCHAR(100) PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Deleted Orders Registry Table (to prevent resurrection during sync)
      await client.query(`
        CREATE TABLE IF NOT EXISTS deleted_orders (
          id VARCHAR(100) PRIMARY KEY,
          deleted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Indexes for high performance searches
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
        CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
        CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch);
      `);

      isDbConnected = true;
      console.log("✅ PostgreSQL tables initialized and ready!");
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    isDbConnected = false;
    const errMsg = err?.message || String(err);
    if (errMsg.includes("getaddrinfo") || errMsg.includes("EAI_AGAIN") || errMsg.includes("ENOTFOUND")) {
      console.log("ℹ️ PostgreSQL Hostname is only accessible inside Render Private Network (or DNS is resolving). Falling back gracefully to Local File Storage.");
    } else {
      console.warn("⚠️ PostgreSQL connection notice:", errMsg, "- Using Local File Storage fallback.");
    }
    return false;
  }
}

export function isPostgresActive(): boolean {
  return Boolean(pool && isDbConnected);
}

// ----------------------------------------------------
// Orders DB Operations
// ----------------------------------------------------
export async function getOrdersFromDb(): Promise<any[]> {
  if (!isPostgresActive() || !pool) return [];
  try {
    const res = await pool.query(`
      SELECT 
        o.id,
        o.order_number AS "orderNumber",
        o.customer_name AS "customerName",
        o.customer_nickname AS "customerNickname",
        o.customer_phone AS "customerPhone",
        o.customer_social AS "customerSocial",
        o.line_user_id AS "lineUserId",
        o.dress_type AS "dressType",
        o.fabric_type AS "fabricType",
        o.price::float AS "price",
        o.deposit::float AS "deposit",
        o.discount::float AS "discount",
        o.status,
        o.status_date AS "statusDate",
        o.order_date AS "orderDate",
        o.delivery_date AS "deliveryDate",
        o.branch,
        o.staff_name AS "staffName",
        o.tailor_name AS "tailorName",
        o.notes,
        o.measurements,
        o.status_history AS "statusHistory",
        o.reference_images AS "referenceImages",
        o.fitting_images AS "fittingImages",
        o.pickup_signee_name AS "pickupSigneeName",
        o.pickup_signed_at AS "pickupSignedAt",
        o.pickup_signature_data AS "pickupSignatureData",
        o.pickup_notes AS "pickupNotes",
        o.updated_at AS "updatedAt",
        o.raw_data AS "rawData"
      FROM orders o
      WHERE o.id NOT IN (SELECT id FROM deleted_orders)
      ORDER BY o.order_number DESC;
    `);

    return res.rows.map(row => {
      // Merge with raw_data to preserve any custom properties
      const raw = row.rawData || {};
      const { rawData, ...rest } = row;
      return { ...raw, ...rest };
    });
  } catch (err) {
    console.error("❌ Error fetching orders from DB:", err);
    return [];
  }
}

export async function saveOrderToDb(order: any): Promise<boolean> {
  if (!isPostgresActive() || !pool || !order || !order.id) return false;
  try {
    const query = `
      INSERT INTO orders (
        id, order_number, customer_name, customer_nickname, customer_phone,
        customer_social, line_user_id, dress_type, fabric_type, price,
        deposit, discount, status, status_date, order_date, delivery_date,
        branch, staff_name, tailor_name, notes, measurements, status_history,
        reference_images, fitting_images, pickup_signee_name, pickup_signed_at,
        pickup_signature_data, pickup_notes, raw_data, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29, $30
      )
      ON CONFLICT (id) DO UPDATE SET
        order_number = EXCLUDED.order_number,
        customer_name = EXCLUDED.customer_name,
        customer_nickname = EXCLUDED.customer_nickname,
        customer_phone = EXCLUDED.customer_phone,
        customer_social = EXCLUDED.customer_social,
        line_user_id = EXCLUDED.line_user_id,
        dress_type = EXCLUDED.dress_type,
        fabric_type = EXCLUDED.fabric_type,
        price = EXCLUDED.price,
        deposit = EXCLUDED.deposit,
        discount = EXCLUDED.discount,
        status = EXCLUDED.status,
        status_date = EXCLUDED.status_date,
        order_date = EXCLUDED.order_date,
        delivery_date = EXCLUDED.delivery_date,
        branch = EXCLUDED.branch,
        staff_name = EXCLUDED.staff_name,
        tailor_name = EXCLUDED.tailor_name,
        notes = EXCLUDED.notes,
        measurements = EXCLUDED.measurements,
        status_history = EXCLUDED.status_history,
        reference_images = EXCLUDED.reference_images,
        fitting_images = EXCLUDED.fitting_images,
        pickup_signee_name = EXCLUDED.pickup_signee_name,
        pickup_signed_at = EXCLUDED.pickup_signed_at,
        pickup_signature_data = EXCLUDED.pickup_signature_data,
        pickup_notes = EXCLUDED.pickup_notes,
        raw_data = EXCLUDED.raw_data,
        updated_at = EXCLUDED.updated_at;
    `;

    const values = [
      order.id,
      order.orderNumber || order.id,
      order.customerName || "ไม่ระบุชื่อ",
      order.customerNickname || null,
      order.customerPhone || "",
      order.customerSocial || null,
      order.lineUserId || null,
      order.dressType || "ชุดสั่งตัด",
      order.fabricType || null,
      Number(order.price) || 0,
      Number(order.deposit) || 0,
      Number(order.discount) || 0,
      order.status || "RECEIVED",
      order.statusDate || null,
      order.orderDate || null,
      order.deliveryDate || null,
      order.branch || "สาขานราธิวาส",
      order.staffName || null,
      order.tailorName || null,
      order.notes || null,
      JSON.stringify(order.measurements || {}),
      JSON.stringify(order.statusHistory || []),
      JSON.stringify(order.referenceImages || []),
      JSON.stringify(order.fittingImages || []),
      order.pickupSigneeName || null,
      order.pickupSignedAt || null,
      order.pickupSignatureData || null,
      order.pickupNotes || null,
      JSON.stringify(order),
      order.updatedAt || Date.now()
    ];

    await pool.query(query, values);
    return true;
  } catch (err) {
    console.error("❌ Error saving order to DB:", err);
    return false;
  }
}

export async function saveMultipleOrdersToDb(orders: any[]): Promise<boolean> {
  if (!isPostgresActive() || !pool || !Array.isArray(orders)) return false;
  try {
    for (const order of orders) {
      await saveOrderToDb(order);
    }
    return true;
  } catch (err) {
    console.error("❌ Error saving multiple orders to DB:", err);
    return false;
  }
}

export async function deleteOrderInDb(id: string): Promise<boolean> {
  if (!isPostgresActive() || !pool || !id) return false;
  try {
    // Record to deleted_orders table to prevent resurrection
    await pool.query(`INSERT INTO deleted_orders (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [id]);
    // Delete from active orders
    await pool.query(`DELETE FROM orders WHERE id = $1`, [id]);
    return true;
  } catch (err) {
    console.error("❌ Error deleting order in DB:", err);
    return false;
  }
}

export async function getDeletedOrderIdsFromDb(): Promise<string[]> {
  if (!isPostgresActive() || !pool) return [];
  try {
    const res = await pool.query(`SELECT id FROM deleted_orders`);
    return res.rows.map(r => r.id);
  } catch (err) {
    console.error("❌ Error getting deleted orders from DB:", err);
    return [];
  }
}

// ----------------------------------------------------
// Catalogue DB Operations
// ----------------------------------------------------
export async function getCatalogueFromDb(): Promise<any[]> {
  if (!isPostgresActive() || !pool) return [];
  try {
    const res = await pool.query(`SELECT raw_data FROM catalogue ORDER BY created_at ASC`);
    return res.rows.map(r => r.raw_data).filter(Boolean);
  } catch (err) {
    console.error("❌ Error getting catalogue from DB:", err);
    return [];
  }
}

export async function saveCatalogueToDb(items: any[]): Promise<boolean> {
  if (!isPostgresActive() || !pool || !Array.isArray(items)) return false;
  try {
    for (const item of items) {
      if (!item.id) continue;
      await pool.query(`
        INSERT INTO catalogue (id, name, dress_type, price, fabric, description, image_url, images, raw_data, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          dress_type = EXCLUDED.dress_type,
          price = EXCLUDED.price,
          fabric = EXCLUDED.fabric,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          images = EXCLUDED.images,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP;
      `, [
        item.id,
        item.name || "",
        item.dressType || "",
        Number(item.price) || 0,
        item.fabric || "",
        item.description || "",
        item.imageUrl || item.image || "",
        JSON.stringify(item.images || []),
        JSON.stringify(item)
      ]);
    }
    return true;
  } catch (err) {
    console.error("❌ Error saving catalogue to DB:", err);
    return false;
  }
}

// ----------------------------------------------------
// Store Settings DB Operations
// ----------------------------------------------------
export async function getSettingsFromDb(): Promise<any> {
  if (!isPostgresActive() || !pool) return {};
  try {
    const res = await pool.query(`SELECT key, value FROM store_settings`);
    const settings: any = {};
    for (const row of res.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  } catch (err) {
    console.error("❌ Error getting settings from DB:", err);
    return {};
  }
}

export async function saveSettingsToDb(settings: any): Promise<boolean> {
  if (!isPostgresActive() || !pool || !settings || typeof settings !== "object") return false;
  try {
    for (const [key, val] of Object.entries(settings)) {
      await pool.query(`
        INSERT INTO store_settings (key, value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP;
      `, [key, JSON.stringify(val)]);
    }
    return true;
  } catch (err) {
    console.error("❌ Error saving settings to DB:", err);
    return false;
  }
}

// ----------------------------------------------------
// Reviews DB Operations
// ----------------------------------------------------
export async function getReviewsFromDb(): Promise<any[]> {
  if (!isPostgresActive() || !pool) return [];
  try {
    const res = await pool.query(`SELECT raw_data FROM reviews ORDER BY created_at DESC`);
    return res.rows.map(r => r.raw_data).filter(Boolean);
  } catch (err) {
    console.error("❌ Error getting reviews from DB:", err);
    return [];
  }
}

export async function saveReviewsToDb(reviews: any[]): Promise<boolean> {
  if (!isPostgresActive() || !pool || !Array.isArray(reviews)) return false;
  try {
    for (const rev of reviews) {
      if (!rev.id) continue;
      await pool.query(`
        INSERT INTO reviews (id, order_id, order_number, customer_name, dress_type, rating, comment, reply_comment, status, images, raw_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          customer_name = EXCLUDED.customer_name,
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          reply_comment = EXCLUDED.reply_comment,
          status = EXCLUDED.status,
          images = EXCLUDED.images,
          raw_data = EXCLUDED.raw_data;
      `, [
        rev.id,
        rev.orderId || null,
        rev.orderNumber || null,
        rev.customerName || "",
        rev.dressType || "",
        Number(rev.rating) || 5,
        rev.comment || "",
        rev.replyComment || null,
        rev.status || "approved",
        JSON.stringify(rev.images || []),
        JSON.stringify(rev)
      ]);
    }
    return true;
  } catch (err) {
    console.error("❌ Error saving reviews to DB:", err);
    return false;
  }
}
