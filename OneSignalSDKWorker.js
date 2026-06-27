// ── SELF-DESTRUCT WORKER ──
// This file used to register a SEPARATE service worker for OneSignal, at the
// same root scope as our main app worker (sw.js). Two workers sharing one
// scope silently fight over who controls push delivery, which is why some
// phones never got notifications even after sw.js was fixed and merged to
// include OneSignal's code directly.
//
// Browsers don't automatically migrate an existing registration to a new URL
// just because the page's config changed — a phone that already subscribed
// against THIS file's URL keeps using it forever until something tells it
// otherwise. This script is that "something": it unregisters itself and
// forces every open tab to re-fetch the page, so they naturally re-register
// against sw.js (the correct, merged worker) on next load.
//
// KEEP THIS FILE until you're confident every team member's phone has visited
// the app at least once after this change shipped (give it a couple of weeks).
// Do not delete it outright in the meantime — a 404 here is messier than this
// clean self-removal for anyone still mid-transition.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(
    self.registration.unregister()
      .then(() => self.clients.matchAll())
      .then(clients => {
        clients.forEach(client => {
          if (client.url && client.navigate) client.navigate(client.url);
        });
      })
  );
});
