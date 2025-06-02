// sw.js

const CACHE_NAME = 'dota2-timer-cache-v1.3'; // Обновите версию при изменениях в файлах для кеширования!
const DYNAMIC_CACHE_NAME = 'dota2-timer-dynamic-v1.3';

// Теперь главный HTML файл - index.html
const MAIN_HTML_FILE = './index.html'; 

const STATIC_ASSETS = [
    './', // Кеширует корень (теперь это будет index.html)
    MAIN_HTML_FILE, // Явно указываем index.html для надежности
    './manifest.json', 
    './dota_icon.png', 
    './warning_alert.mp3',
    './event_now_alert.mp3'
    // Если у вас есть отдельные CSS/JS файлы, которые не встроены в HTML, добавьте их сюда:
    // './style.css',
    // './script.js', 
];

// Установка Service Worker: кеширование статических ассетов
self.addEventListener('install', event => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Precaching App Shell:', STATIC_ASSETS);
                const uniqueAssetsToCache = [...new Set(STATIC_ASSETS.filter(url => url))];
                return cache.addAll(uniqueAssetsToCache);
            })
            .catch(err => {
                console.error('[SW] Precaching failed:', err);
            })
    );
});

// Активация Service Worker: очистка старых кешей
self.addEventListener('activate', event => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(keyList.map(key => {
                if (key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
                    console.log('[SW] Removing old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim(); 
});

// Обработка запросов Fetch
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Стратегия: Cache first, then Network для HTML и статических ассетов
    // Проверяем, соответствует ли запрос одному из статических ассетов или является навигационным запросом
    const isStaticAsset = STATIC_ASSETS.some(asset => {
        // Для './' asset, проверяем, является ли это корневым путем
        if (asset === './') return url.pathname === '/' || url.pathname === '/index.html';
        // Для других ассетов, проверяем окончание пути
        return url.pathname.endsWith(asset.substring(1)); // Убираем начальную точку из asset
    });

    if (event.request.mode === 'navigate' || isStaticAsset) {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.ok) {
                             const responseToCache = networkResponse.clone();
                             caches.open(CACHE_NAME).then(cache => { 
                                 cache.put(event.request, responseToCache);
                             });
                        }
                        return networkResponse;
                    }).catch(err => {
                        console.warn(`[SW] Network request for ${event.request.url} failed, trying fallback. Error: ${err}`);
                        // Если это HTML и он не найден в сети, отдаем закешированный главный HTML как fallback
                        if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
                            return caches.match(MAIN_HTML_FILE);
                        }
                    });
                })
        );
    } else {
        // Для других запросов: Network first, then Cache
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return caches.match(event.request).then(cacheResponse => cacheResponse || response);
                    }
                    const responseToCache = response.clone();
                    caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request)) 
        );
    }
});
