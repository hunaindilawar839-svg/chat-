importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const CACHE_NAME = 'navain-chat-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

firebase.initializeApp({
  apiKey: "AIzaSyDx8lHXrrLC0PxepECIu_vjF5-oybPQVkY",
  authDomain: "navainchat.firebaseapp.com",
  projectId: "navainchat",
  storageBucket: "navainchat.firebasestorage.app",
  messagingSenderId: "710372876596",
  appId: "1:710372876596:web:6054085a29873322db0561"
});

const messaging = firebase.messaging();

// Background push handler — shows native OS notification when app is closed/backgrounded
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Navain Chat', {
    body: body || 'New message',
    icon: icon || './icon-192.png',
    badge: './icon-192.png',
    tag: 'navain-chat-msg',
    renotify: true,
    data: { url: self.location.origin }
  });
});

// Click on notification → open/focus the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || self.location.origin;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(target) && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow(target);
    })
  );
});

// Cache shell
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok){ const clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, clone)); }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
