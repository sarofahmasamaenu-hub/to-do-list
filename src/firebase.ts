import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  arrayUnion
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Order, CatalogueItem } from './types';

// The Firebase configuration provided by the atelier
export const firebaseConfig = {
  apiKey: "AIzaSyDbt86w9Tl3HTlmlQwr4P7StoBKyEC56vc",
  authDomain: "nuhpre-order.firebaseapp.com",
  projectId: "nuhpre-order",
  storageBucket: "nuhpre-order.firebasestorage.app",
  messagingSenderId: "81774640286",
  appId: "1:81774640286:web:e596d6d5bb638d11380f8f",
  measurementId: "G-YNVY3Y03PY"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Test the Firestore connection to verify readiness with latency benchmark
 */
export async function testFirestoreConnection(): Promise<{ success: boolean; latencyMs: number; projectId: string; message: string }> {
  const startTime = Date.now();
  try {
    const testDocRef = doc(db, 'system', 'connection_test');
    await setDoc(testDocRef, {
      lastPingAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'active'
    }, { merge: true });
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      latencyMs,
      projectId: firebaseConfig.projectId,
      message: `เชื่อมต่อสำเร็จกับโปรเจกต์ ${firebaseConfig.projectId} (${latencyMs}ms)`
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      projectId: firebaseConfig.projectId,
      message: error?.message || 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบการตั้งค่า Firestore Rules'
    };
  }
}

// Global in-memory registry of deleted order IDs to guard against zombie saves
const inMemoryDeletedIds = new Set<string>();

// Initialize from localStorage if available
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('nunuh_deleted_order_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(id => inMemoryDeletedIds.add(id));
      }
    }
  } catch (e) {}
}

export function registerDeletedIdInMemory(id: string) {
  if (id) inMemoryDeletedIds.add(id);
}

/**
 * Save / Update a single order in Firestore
 */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  if (!order || !order.id) return;
  if (inMemoryDeletedIds.has(order.id)) {
    console.warn(`[Firestore Guard] Blocked resurrecting deleted order ${order.id}`);
    deleteDoc(doc(db, 'orders', order.id)).catch(() => {});
    return;
  }
  try {
    const orderDocRef = doc(db, 'orders', order.id);
    await setDoc(orderDocRef, {
      ...order,
      _syncedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Error saving order to Firestore:', e);
  }
}

/**
 * Batch save multiple orders to Firestore
 */
export async function saveOrdersBatchToFirestore(orders: Order[]): Promise<void> {
  if (!orders || orders.length === 0) return;
  try {
    const validOrders = orders.filter(o => o && o.id && !inMemoryDeletedIds.has(o.id));
    const deletedInBatch = orders.filter(o => o && o.id && inMemoryDeletedIds.has(o.id));
    
    // Purge any deleted orders if someone tried to batch-save them
    for (const d of deletedInBatch) {
      deleteDoc(doc(db, 'orders', d.id)).catch(() => {});
    }

    const promises = validOrders.map(order => {
      const orderDocRef = doc(db, 'orders', order.id);
      return setDoc(orderDocRef, {
        ...order,
        _syncedAt: new Date().toISOString()
      }, { merge: true });
    });
    await Promise.all(promises);
  } catch (e) {
    console.warn('Error batch saving orders to Firestore:', e);
  }
}

/**
 * Delete an order from Firestore and record in deleted_orders registry
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  if (!orderId) return;
  inMemoryDeletedIds.add(orderId);
  try {
    const orderDocRef = doc(db, 'orders', orderId);
    await deleteDoc(orderDocRef);

    // Save to deleted_orders doc so all devices across the world sync the deletion in real-time
    const deletedDocRef = doc(db, 'settings', 'deleted_orders');
    try {
      await setDoc(deletedDocRef, {
        deletedIds: arrayUnion(orderId),
        lastDeletedId: orderId,
        _syncedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Error recording deleted order in Firestore registry:', err);
    }
  } catch (e) {
    console.warn('Error deleting order from Firestore:', e);
  }
}

/**
 * Record multiple deleted order IDs into Firestore registry atomically
 */
export async function recordDeletedOrderIdsInFirestore(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  ids.forEach(id => inMemoryDeletedIds.add(id));
  try {
    const deletedDocRef = doc(db, 'settings', 'deleted_orders');
    await setDoc(deletedDocRef, {
      deletedIds: arrayUnion(...ids),
      _syncedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Error recording deleted order IDs in Firestore:', e);
  }
}

/**
 * Fetch list of deleted order IDs from Firestore
 */
export async function fetchDeletedOrderIdsFromFirestore(): Promise<string[]> {
  try {
    const docRef = doc(db, 'settings', 'deleted_orders');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.deletedIds)) {
        data.deletedIds.forEach((id: string) => inMemoryDeletedIds.add(id));
        return data.deletedIds;
      }
    }
  } catch (e) {
    console.warn('Error fetching deleted orders from Firestore:', e);
  }
  return [];
}

/**
 * Listen for real-time deleted order events across all devices
 */
export function subscribeToDeletedOrders(onDeleted: (deletedIds: string[]) => void): () => void {
  try {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'deleted_orders'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((id: string) => inMemoryDeletedIds.add(id));
          onDeleted(data.deletedIds);
        }
      }
    }, (error) => {
      console.warn('Firestore deleted orders subscription error:', error);
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not attach Firestore deleted orders listener:', e);
    return () => {};
  }
}

/**
 * Helper to normalize Firestore doc into a complete Order object
 */
export function mapDocToOrder(docSnap: any): Order {
  const data = docSnap.data ? (docSnap.data() || {}) : (docSnap || {});
  const id = data.id || docSnap.id || ('order-' + Date.now());
  
  // Reconstruct measurements if flattened or missing
  let measurements = data.measurements;
  if (!measurements || typeof measurements !== 'object') {
    measurements = {
      chest: data.chest || '',
      waist: data.waist || '',
      hips: data.hips || '',
      shoulder: data.shoulder || '',
      sleeveLength: data.sleeveLength || '',
      length: data.length || '',
      armhole: data.armhole || '',
      frontChest: data.frontChest || '',
      backChest: data.backChest || '',
      frontLength: data.frontLength || '',
      backLength: data.backLength || '',
      wrist: data.wrist || '',
      neck: data.neck || '',
      height: data.height || '',
      weight: data.weight || '',
      standardSize: data.standardSize || '',
      otherNotes: data.otherNotes || ''
    };
  }

  return {
    id,
    orderNumber: data.orderNumber || ('NU-' + id.replace(/[^0-9]/g, '').slice(-5)),
    customerName: data.customerName || 'ลูกค้าห้องเสื้อ',
    customerNickname: data.customerNickname || '',
    customerPhone: data.customerPhone || '',
    customerSocial: data.customerSocial || '',
    dressType: data.dressType || 'ชุดสั่งตัดพิเศษ',
    fabricType: data.fabricType || '-',
    fabricColor: data.fabricColor || '-',
    orderDate: data.orderDate || new Date().toISOString().split('T')[0],
    deliveryDate: data.deliveryDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    price: typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0,
    deposit: typeof data.deposit === 'number' ? data.deposit : parseFloat(data.deposit) || 0,
    discount: typeof data.discount === 'number' ? data.discount : parseFloat(data.discount) || 0,
    measurements,
    status: data.status || 'RECEIVED',
    statusDate: data.statusDate || new Date().toISOString().split('T')[0],
    statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
    notes: data.notes || '',
    customImage: data.customImage || '',
    customImage2: data.customImage2 || '',
    customerPhotoFront: data.customerPhotoFront || '',
    customerPhotoSide: data.customerPhotoSide || '',
    customerPhotoBack: data.customerPhotoBack || '',
    customerPhotoExtra1: data.customerPhotoExtra1 || '',
    customerPhotoExtra2: data.customerPhotoExtra2 || '',
    pickupSignature: data.pickupSignature || undefined,
    pickupSignedAt: data.pickupSignedAt || undefined,
    pickupSigneeName: data.pickupSigneeName || undefined,
    paymentMethod: data.paymentMethod || undefined,
    branch: data.branch || undefined,
    staffName: data.staffName || undefined,
    staffBranch: data.staffBranch || undefined,
    tailorName: data.tailorName || undefined,
    customerCategory: data.customerCategory || undefined,
    membershipTier: data.membershipTier || undefined,
    selectedDesignId: data.selectedDesignId || undefined,
    updatedAt: data.updatedAt || Date.now()
  };
}

/**
 * Fetch all orders directly from Firestore
 */
export async function fetchOrdersFromFirestore(): Promise<Order[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'orders'));
    const orders: Order[] = [];
    querySnapshot.forEach((docSnap) => {
      if (inMemoryDeletedIds.has(docSnap.id)) {
        deleteDoc(doc(db, 'orders', docSnap.id)).catch(() => {});
      } else {
        orders.push(mapDocToOrder(docSnap));
      }
    });
    return orders;
  } catch (e) {
    console.warn('Error fetching orders from Firestore:', e);
    return [];
  }
}

/**
 * Listen for real-time order updates across all connected devices
 */
export function subscribeToOrders(onUpdate: (orders: Order[], removedIds: string[]) => void): () => void {
  try {
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const updatedOrders: Order[] = [];
      const removedIds: string[] = [];

      // Detect document deletions in real-time
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          removedIds.push(change.doc.id);
        }
      });

      snapshot.forEach((docSnap) => {
        if (inMemoryDeletedIds.has(docSnap.id)) {
          deleteDoc(doc(db, 'orders', docSnap.id)).catch(() => {});
          if (!removedIds.includes(docSnap.id)) {
            removedIds.push(docSnap.id);
          }
        } else {
          updatedOrders.push(mapDocToOrder(docSnap));
        }
      });

      onUpdate(updatedOrders, removedIds);
    }, (error) => {
      console.warn('Firestore real-time subscription error:', error);
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not attach Firestore onSnapshot:', e);
    return () => {};
  }
}

/**
 * Sync Settings to Firestore
 */
export async function saveSettingsToFirestore(settings: Record<string, any>): Promise<void> {
  try {
    const settingsDocRef = doc(db, 'settings', 'general');
    await setDoc(settingsDocRef, {
      ...settings,
      _syncedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Error saving settings to Firestore:', e);
  }
}

/**
 * Fetch Settings from Firestore
 */
export async function fetchSettingsFromFirestore(): Promise<Record<string, any> | null> {
  try {
    const docRef = doc(db, 'settings', 'general');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    const snapshot = await getDocs(collection(db, 'settings'));
    let result: Record<string, any> | null = null;
    snapshot.forEach((d) => {
      if (d.id === 'general') {
        result = d.data();
      }
    });
    return result;
  } catch (e) {
    console.warn('Error fetching settings from Firestore:', e);
    return null;
  }
}

/**
 * Listen for real-time settings (Logo, Theme, Phone, etc.) across all connected devices
 */
export function subscribeToSettings(onUpdate: (settings: Record<string, any>) => void): () => void {
  try {
    const docRef = doc(db, 'settings', 'general');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          onUpdate(data);
        }
      }
    }, (error) => {
      console.warn('Firestore settings real-time subscription error:', error);
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not attach Firestore settings onSnapshot:', e);
    return () => {};
  }
}

/**
 * Sync Catalogue to Firestore
 */
export async function saveCatalogueToFirestore(items: CatalogueItem[]): Promise<void> {
  try {
    const promises = items.map(item => {
      const itemRef = doc(db, 'catalogue', item.id);
      return setDoc(itemRef, {
        ...item,
        _syncedAt: new Date().toISOString()
      }, { merge: true });
    });
    await Promise.all(promises);
  } catch (e) {
    console.warn('Error saving catalogue to Firestore:', e);
  }
}

/**
 * Register or update staff / active user online heartbeat in Firestore
 */
export async function registerStaffOnline(staff: { id: string; name: string; branch: string; role?: string }): Promise<void> {
  if (!staff || !staff.id) return;
  try {
    const presenceRef = doc(db, 'online_staff', staff.id);
    await setDoc(presenceRef, {
      id: staff.id,
      name: staff.name,
      branch: staff.branch || 'สาขาหลัก',
      role: staff.role || 'Staff',
      lastActive: Date.now(),
      _updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Error recording staff presence in Firestore:', e);
  }
}

/**
 * Remove staff from online roster upon logout
 */
export async function removeStaffOnline(staffId: string): Promise<void> {
  if (!staffId) return;
  try {
    const presenceRef = doc(db, 'online_staff', staffId);
    await deleteDoc(presenceRef);
  } catch (e) {
    console.warn('Error removing staff presence in Firestore:', e);
  }
}

/**
 * Listen for real-time online staff and active users across all devices
 */
export function subscribeToOnlineStaff(
  onUpdate: (activeStaff: Array<{ id: string; name: string; branch: string; loginTime?: number; lastActive?: number }>) => void
): () => void {
  try {
    const unsubscribe = onSnapshot(collection(db, 'online_staff'), (snapshot) => {
      const activeList: Array<{ id: string; name: string; branch: string; loginTime?: number; lastActive?: number }> = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Only count sessions active in the last 2 minutes
        if (data && data.lastActive && (now - data.lastActive) < 120000) {
          activeList.push({
            id: data.id || docSnap.id,
            name: data.name || 'พนักงานห้องเสื้อ',
            branch: data.branch || 'สาขาหลัก',
            loginTime: data.loginTime || data.lastActive,
            lastActive: data.lastActive
          });
        }
      });
      onUpdate(activeList);
    }, (err) => {
      console.warn('Online staff listener error:', err);
    });
    return unsubscribe;
  } catch (e) {
    console.warn('Could not subscribe to online staff:', e);
    return () => {};
  }
}

/**
 * Force sync all local orders to Firestore
 */
export async function syncAllLocalOrdersToFirestore(orders: Order[]): Promise<{ count: number; success: boolean; error?: string }> {
  if (!orders || orders.length === 0) return { count: 0, success: true };
  try {
    let synced = 0;
    for (const order of orders) {
      if (order && order.id) {
        if (inMemoryDeletedIds.has(order.id)) {
          deleteDoc(doc(db, 'orders', order.id)).catch(() => {});
          continue;
        }
        const orderDocRef = doc(db, 'orders', order.id);
        await setDoc(orderDocRef, {
          ...order,
          _syncedAt: new Date().toISOString()
        }, { merge: true });
        synced++;
      }
    }
    return { count: synced, success: true };
  } catch (e: any) {
    console.warn('Error syncing all orders to Firestore:', e);
    return { count: 0, success: false, error: e?.message || 'Sync failed' };
  }
}

