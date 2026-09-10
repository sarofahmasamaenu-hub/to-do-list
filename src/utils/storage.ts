/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order } from '../types';

/**
 * Compacts an order object specifically for localStorage caching.
 * Reduces or omits huge base64 payloads so that 100+ orders fit within 5MB quota.
 */
export function compactOrderForCache(order: Order): Order {
  if (!order) return order;

  // Helper to trim large base64 image strings (> 15KB) for local cache only
  // (The full resolution image remains safe in Firestore and active React state)
  const trimLargeBase64 = (str?: string): string => {
    if (!str) return '';
    if (str.startsWith('data:') && str.length > 25000) {
      // Keep a lightweight placeholder flag or truncated marker for cache
      return str.slice(0, 100) + '...[CACHED_ON_CLOUD]';
    }
    return str;
  };

  return {
    ...order,
    customImage: trimLargeBase64(order.customImage),
    customImage2: trimLargeBase64(order.customImage2),
    customerPhotoFront: trimLargeBase64(order.customerPhotoFront),
    customerPhotoSide: trimLargeBase64(order.customerPhotoSide),
    customerPhotoBack: trimLargeBase64(order.customerPhotoBack),
    customerPhotoExtra1: trimLargeBase64(order.customerPhotoExtra1),
    customerPhotoExtra2: trimLargeBase64(order.customerPhotoExtra2),
    pickupSignature: trimLargeBase64(order.pickupSignature),
  };
}

/**
 * Compacts a list of orders for localStorage
 */
export function compactOrdersListForCache(orders: Order[]): Order[] {
  if (!Array.isArray(orders)) return [];
  return orders.map(compactOrderForCache);
}

/**
 * Safely writes a value to localStorage without throwing QuotaExceededError or crashing React.
 */
export function safeSetLocalStorage(key: string, value: any): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

  try {
    localStorage.setItem(key, stringValue);
    return true;
  } catch (error: any) {
    console.warn(`[SafeStorage] Quota exceeded or error setting key "${key}":`, error?.message || error);

    // If setting nunuh_orders failed due to quota, try compacting
    if (key === 'nunuh_orders') {
      try {
        let ordersArray: Order[] = [];
        if (typeof value === 'string') {
          try { ordersArray = JSON.parse(value); } catch (e) {}
        } else if (Array.isArray(value)) {
          ordersArray = value;
        }

        if (ordersArray.length > 0) {
          const compacted = compactOrdersListForCache(ordersArray);
          localStorage.setItem('nunuh_orders', JSON.stringify(compacted));
          console.info(`[SafeStorage] Successfully stored compacted orders cache (${compacted.length} items).`);
          return true;
        }
      } catch (compactError) {
        console.warn('[SafeStorage] Compacted storage also exceeded quota. Cleaning temp caches...', compactError);
      }
    }

    // Try cleaning up old non-essential caches
    try {
      localStorage.removeItem('nunuh_last_draft_order');
      localStorage.removeItem('nunuh_active_staff_list');
      localStorage.removeItem('nunuh_reviews');
      
      // Try setting one last time
      if (key === 'nunuh_orders' && typeof value !== 'string') {
        const compacted = compactOrdersListForCache(value);
        localStorage.setItem(key, JSON.stringify(compacted));
      } else {
        localStorage.setItem(key, stringValue.slice(0, 100000)); // Cap length
      }
      return true;
    } catch (finalError) {
      console.warn(`[SafeStorage] Could not persist key "${key}" to localStorage. Memory and Firestore will be used.`, finalError);
      return false;
    }
  }
}

/**
 * Safely gets a value from localStorage
 */
export function safeGetLocalStorage(key: string, defaultValue: string | null = null): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaultValue;
  }
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (e) {
    console.warn(`[SafeStorage] Error getting key "${key}":`, e);
    return defaultValue;
  }
}

/**
 * Safely removes a value from localStorage
 */
export function safeRemoveLocalStorage(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[SafeStorage] Error removing key "${key}":`, e);
  }
}
