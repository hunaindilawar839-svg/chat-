// ── MERGED SERVICE WORKER ──
// This single file handles BOTH push systems used by Navain Chat:
//   1. OneSignal (sendPushTo() in index.html — DMs, mentions, leads, calls)
//   2. Firebase Cloud Messaging (legacy/secondary path via initNotifications())
// Previously these lived in two separate files (sw.js + OneSignalSDKWorker.js)
// registered at the same root scope, which silently fights over who controls
// push delivery — especially after reinstalls/cache clears, which happen far
// more often on mobile than on a desktop tab left open for days. Combining
// them into one file/one scope removes that collision entirely.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const CACHE_NAME = 'navain-chat-v4';
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

// Cache shell.
// NOTE: we deliberately do NOT call self.skipWaiting() or self.clients.claim()
// here. Doing so takes control of tabs that are already open mid-session,
// which can cause an already-loaded page's module script to be re-executed
// (e.g. via Firebase Auth redirect flows or bfcache restores) and throw
// "Identifier 'X' has already been declared". Instead, the new SW waits
// until the user actually reloads/relaunches the app, which is the normal,
// safe PWA update lifecycle.
//
// IMPORTANT: cache.addAll() is all-or-nothing — if ANY one of these URLs
// fails to fetch cleanly (a 404, a redirect quirk, a transient network blip,
// hosting-specific routing behavior, etc.), the WHOLE install step rejects.
// A failed install never reaches "activated" — it just silently retries on
// every future page load forever, which looks exactly like a page that keeps
// reloading and never settles. We cache each file independently instead, so
// one bad/missing entry can't take down the entire installation.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(SHELL.map(url =>
        cache.add(url).catch(err => console.warn('SW: failed to pre-cache', url, err))
      ))
    )
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
});

// Let a waiting SW be told to activate explicitly (e.g. from an in-app
// "Update available" button), rather than doing it automatically.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
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
