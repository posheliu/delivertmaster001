/* Divery Master Service Worker
   讓 Android Chrome 可「安裝」成全螢幕 App；
   採「網路優先」：有網路一律抓最新檔案，沒網路時才用快取，所以更新程式後不會卡在舊版。 */
const CACHE = 'divery-master-v1';
const CORE = ['./', './index.html', './style.css', './app.js', './data.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // 地圖等外部資源不處理
    e.respondWith(
        fetch(req).then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
            return res;
        }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
});
