// Safe DB module loader across Vercel Serverless and Node.js environments
let cachedDbModule: any = null;

export async function getDbModule(): Promise<any> {
  if (cachedDbModule) return cachedDbModule;

  // 1. Try local api/_db.js
  try {
    const mod: any = await import("./_db.js");
    if (mod && (mod.isPostgresActive || mod.default?.isPostgresActive)) {
      cachedDbModule = mod.isPostgresActive ? mod : mod.default;
      return cachedDbModule;
    }
  } catch (e) {}

  // 2. Try root db.js
  try {
    const mod: any = await import("../db.js");
    if (mod && (mod.isPostgresActive || mod.default?.isPostgresActive)) {
      cachedDbModule = mod.isPostgresActive ? mod : mod.default;
      return cachedDbModule;
    }
  } catch (e) {}

  // 3. Try local api/_db.ts
  try {
    const mod: any = await import("./_db");
    if (mod && (mod.isPostgresActive || mod.default?.isPostgresActive)) {
      cachedDbModule = mod.isPostgresActive ? mod : mod.default;
      return cachedDbModule;
    }
  } catch (e) {}

  // 4. Try root db.ts
  try {
    const mod: any = await import("../db");
    if (mod && (mod.isPostgresActive || mod.default?.isPostgresActive)) {
      cachedDbModule = mod.isPostgresActive ? mod : mod.default;
      return cachedDbModule;
    }
  } catch (e) {}

  // Fallback safe mock: prevents ANY 500 error / ERR_MODULE_NOT_FOUND on Vercel
  cachedDbModule = {
    initDb: async () => false,
    isPostgresActive: () => false,
    getOrdersFromDb: async () => [],
    saveMultipleOrdersToDb: async () => false,
    saveOrderToDb: async () => false,
    deleteOrderInDb: async () => false,
    getDeletedOrderIdsFromDb: async () => [],
    getSettingsFromDb: async () => ({}),
    saveSettingsToDb: async () => false,
    getCatalogueFromDb: async () => [],
    saveCatalogueToDb: async () => false,
    getReviewsFromDb: async () => [],
    saveReviewsToDb: async () => false,
    getUsersFromDb: async () => [],
    saveUserToDb: async () => false,
  };

  return cachedDbModule;
}

