importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const config = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: config.get('apiKey'),
  authDomain: config.get('authDomain'),
  projectId: config.get('projectId'),
  messagingSenderId: config.get('messagingSenderId'),
  appId: config.get('appId'),
});

firebase.messaging();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.FCM_MSG?.data?.url || '/#announcements';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const targetUrl = new URL(target, self.location.origin).href;
      const targetPath = new URL(targetUrl).pathname;
      const existing = windows.find(
        (client) => new URL(client.url).pathname === targetPath
      );
      if (existing) {
        if (existing.url !== targetUrl) await existing.navigate(targetUrl);
        return existing.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});
