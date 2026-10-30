// KML/KMZ View — vỏ ứng dụng (PWA). Nội dung app luôn lấy trực tiếp từ Apps Script nên KHÔNG lưu đệm ở đây;
// service worker chỉ giữ vài file vỏ (mở được màn hình chờ khi mất mạng) và nhận file được "Chia sẻ" vào app.
const VER = 'kxapp-1.3.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './maskable-512.png'];
const SHARE = 'kxapp-share';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VER && k !== SHARE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function onShare(req) {
  try {
    const fd = await req.formData(), files = fd.getAll('files').filter(f => f && typeof f === 'object' && f.size);
    const c = await caches.open(SHARE);
    for (const k of await c.keys()) await c.delete(k);                     // chỉ giữ lần chia sẻ mới nhất
    let i = 0;
    for (const f of files.slice(0, 20)) {
      await c.put(new Request('./__share/' + (i++)), new Response(f, {
        headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || ('file-' + i)) } }));
    }
  } catch (e) { /* bỏ qua: vẫn mở app */ }
  return Response.redirect('./?share=' + Date.now(), 303);
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                          // Apps Script, bản đồ…: để trình duyệt tự xử lý
  if (req.method === 'POST' && url.pathname.endsWith('/share')) { e.respondWith(onShare(req)); return; }
  if (req.method !== 'GET') return;
  // vỏ app: lấy bản mới trên mạng trước (tự cập nhật), mất mạng thì dùng bản đã lưu
  e.respondWith(fetch(req).then(r => {
    if (r && r.ok && r.type === 'basic') { const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
