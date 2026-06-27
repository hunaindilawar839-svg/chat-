// ── ONESIGNAL SERVICE WORKER (scoped to /push/, NOT root) ──
// This file is intentionally OneSignal-only and lives in its own
// subdirectory so it registers at the '/push/' scope instead of root.
// That keeps it from ever colliding with sw.js (our app's worker, at root
// scope) — only one worker can control a given scope, and trying to share
// root between this and a PWA caching worker caused a stuck "installing"
// loop (see sw.js header comment for the full story).
//
// index.html's initOneSignal() must pass serviceWorkerPath:'push/OneSignalSDKWorker.js'
// and serviceWorkerParam:{ scope:'/push/' } to OneSignal.init() for this to
// be found and used correctly.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
