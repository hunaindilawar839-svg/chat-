// ── APP SERVICE WORKER (root scope) ──
// Handles Firebase Cloud Messaging background push + PWA offline caching.
//
// IMPORTANT: this file intentionally does NOT import OneSignal's worker.
// We tried merging both into one file/one scope (see git history), but
// Chrome's "Event handler must be added on the initial evaluation of worker
// script" requirement + OneSignal's own internal install/activate listeners
// caused this worker to get stuck permanently "trying to install" — visible
// as a page that reloads endlessly and never settles. OneSignal's own docs
// recommend separate files at separate scopes as the simpler, more reliable
// setup; only combine if you specifically need a single file. See
// push/OneSignalSDKWorker.js for the OneSignal worker, registered at the
// '/push/' scope so it can never collide with this one again.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const CACHE_NAME = 'navain-chat-v5';
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
// cache.addAll() is all-or-nothing — if ANY one of these URLs fails to fetch
// cleanly, the WHOLE install step rejects and the worker never reaches
// "activated", which looks exactly like a page that reloads and never
// settles. We cache each file independently so one bad entry can't take
// down the entire installation.
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
