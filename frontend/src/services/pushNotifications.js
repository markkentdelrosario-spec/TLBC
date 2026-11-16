import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { firebaseApp, firebaseConfig } from '../config/firebase';
import { apiRequest } from './api';

function tokenStorageKey(userId) {
  return `tlbc-push-token:${userId}`;
}

export async function registerPushNotifications(userId, getIdToken, apiBaseUrl) {
  if (Capacitor.isNativePlatform()) {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      throw new Error('Allow notifications in Android settings to enable push alerts.');
    }

    let registrationListener;
    let registrationErrorListener;
    let timeoutId;
    let resolveToken;
    let rejectToken;
    const tokenPromise = new Promise((resolve, reject) => {
      resolveToken = resolve;
      rejectToken = reject;
    });
    const tokenResultPromise = tokenPromise.then(
      (token) => ({ token }),
      (error) => ({ error })
    );
    registrationListener = PushNotifications.addListener(
      'registration',
      ({ value }) => resolveToken(value)
    );
    registrationErrorListener = PushNotifications.addListener(
      'registrationError',
      ({ error }) => {
        rejectToken(new Error(error || 'Firebase push registration failed.'));
      }
    );

    try {
      await Promise.all([registrationListener, registrationErrorListener]);
      await PushNotifications.register();
      const tokenResult = await Promise.race([
        tokenResultPromise,
        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Timed out while registering this device for push alerts.')),
            15000
          );
        }),
      ]);
      if (tokenResult.error) throw tokenResult.error;
      const { token } = tokenResult;
      if (!token) throw new Error('Firebase did not provide a push token for this device.');

      await apiRequest('/notifications/push-token', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      localStorage.setItem(tokenStorageKey(userId), token);
      return token;
    } finally {
      clearTimeout(timeoutId);
      await Promise.all([
        registrationListener.then((listener) => listener.remove()),
        registrationErrorListener.then((listener) => listener.remove()),
      ]);
    }
  }

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
  if (Capacitor.isNativePlatform()) {
    const receivedListener = await PushNotifications.addListener(
      'pushNotificationReceived',
      onPushMessage
    );
    return () => {
      receivedListener.remove().catch((error) => {
        console.error('Unable to remove native push notification listeners.', error);
      });
    };
  }
  if (!firebaseApp || !firebaseConfig.messagingSenderId || !(await isSupported())) {
    return () => {};
  }
  return onMessage(getMessaging(firebaseApp), onPushMessage);
}

export function hasRegisteredPushToken(userId) {
  return Boolean(userId && localStorage.getItem(tokenStorageKey(userId)));
}
