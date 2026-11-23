// MiHi TOEIC Service Worker for Daily Reminders, Web Push & PWA
const CACHE_NAME = 'mihi-toeic-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Web Push event from Google FCM / Apple APNs server
self.addEventListener('push', (event) => {
  let data = {
    title: '🔥 MiHi TOEIC: Đến giờ học rồi!',
    body: 'Cùng vào luyện tập để nâng cao điểm số và giữ vững chuỗi Streak nhé!'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: '🔥 MiHi TOEIC',
        body: event.data.text()
      };
    }
  }

  const options = {
    body: data.body || 'Cùng vào luyện tập ngay nào!',
    icon: data.icon || 'https://estudyme.com/images/icon/estudyme/favicon.png',
    badge: data.badge || 'https://estudyme.com/images/icon/estudyme/favicon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'mihi-toeic-reminder',
    renotify: true,
    data: data.data || { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'MiHi TOEIC', options)
  );
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
