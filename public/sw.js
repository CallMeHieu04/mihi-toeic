// MiHi TOEIC Service Worker for Daily Reminders & PWA
const CACHE_NAME = 'mihi-toeic-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Listen for messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_REMINDER_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: 'https://estudyme.com/images/icon/estudyme/favicon.png',
      badge: 'https://estudyme.com/images/icon/estudyme/favicon.png',
      vibrate: [200, 100, 200],
      ...options
    });
  }
});
