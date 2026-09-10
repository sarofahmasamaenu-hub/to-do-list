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
  getDocFromServer
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

/**
 * Save / Update a single order in Firestore
 */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  if (!order || !order.id) return;
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
    const promises = orders.map(order => {
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
 * Delete an order from Firestore
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  if (!orderId) return;
  try {
    const orderDocRef = doc(db, 'orders', orderId);
    await deleteDoc(orderDocRef);
  } catch (e) {
    console.warn('Error deleting order from Firestore:', e);
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
    querySnapshot.forEach((doc) => {
      orders.push(mapDocToOrder(doc));
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
export function subscribeToOrders(onUpdate: (orders: Order[]) => void): () => void {
  try {
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const updatedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        updatedOrders.push(mapDocToOrder(doc));
      });
      if (updatedOrders.length > 0) {
        onUpdate(updatedOrders);
      }
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

