import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { firebaseApp, firebaseConfig } from '../config/firebase';
import { apiRequest } from './api';

function tokenStorageKey(userId) {
  return `tlbc-push-token:${userId}`;
}

export async function registerPushNotifications(userId, getIdToken, apiBaseUrl) {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!firebaseApp || !firebaseConfig.messagingSenderId || !vapidKey) {
    throw new Error('Push notifications require Firebase Messaging and a VAPID key in the app configuration.');
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) {
    throw new Error('Push notifications are not supported by this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Allow notifications in your browser settings to enable push alerts.');
  }

  const workerUrl = new URL('/firebase-messaging-sw.js', window.location.origin);
  Object.entries(firebaseConfig).forEach(([key, value]) => {
    if (value) workerUrl.searchParams.set(key, value);
  });
  const registration = await navigator.serviceWorker.register(workerUrl.toString(), {
    scope: '/',
  });
  const token = await getToken(getMessaging(firebaseApp), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('Firebase did not provide a push token for this device.');

  await apiRequest('/notifications/push-token', {
    getIdToken,
    apiBaseUrl,
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  localStorage.setItem(tokenStorageKey(userId), token);
  return token;
}

export async function removePushNotifications(userId, getIdToken, apiBaseUrl) {
  const key = tokenStorageKey(userId);
  const token = localStorage.getItem(key);
  if (!token) return;
  await apiRequest('/notifications/push-token', {
    getIdToken,
    apiBaseUrl,
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
  localStorage.removeItem(key);
}

export async function listenForPushMessages(onPushMessage) {
  if (!firebaseApp || !firebaseConfig.messagingSenderId || !(await isSupported())) {
    return () => {};
  }
  return onMessage(getMessaging(firebaseApp), onPushMessage);
}

export function hasRegisteredPushToken(userId) {
  return Boolean(userId && localStorage.getItem(tokenStorageKey(userId)));
}
