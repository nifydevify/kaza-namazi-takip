// Basit "network falling back to cache" service worker. Uygulama tek dosya
// olduğu için build adımı yok; önbelleği güncellemek için CACHE_NAME'i
// artırmak yeterli — install/activate eski önbelleği otomatik temizler.
const CACHE_NAME = "kaza-namazi-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Yalnızca kendi statik dosyalarımıza (aynı origin) karışıyoruz. Firebase
  // Auth/Firestore/gstatic gibi üçüncü taraf isteklerini olduğu gibi ağa
  // bırakıyoruz — aksi halde onları da önbelleğe almaya çalışırdık, ve
  // çevrimdışıyken başarısız bir Firestore isteğine yanlışlıkla index.html
  // içeriğini "yanıt" olarak döndürürdük.
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
  );
});
