// sw.js

const CACHE_NAME = 'dota2-timer-cache-v1.2'; // Обновите версию при изменениях в файлах для кеширования!
const DYNAMIC_CACHE_NAME = 'dota2-timer-dynamic-v1.2';

// Замените 'dota_timer.html' на фактическое имя вашего основного HTML файла, если оно другое.
// Если ваш HTML-файл называется index.html и лежит в корне рядом с sw.js, то './' будет достаточно.
const HTML_FILE_NAME = './'; // Или './dota_timer.html', если ваш файл так называется

const STATIC_ASSETS = [
    HTML_FILE_NAME,
    './dota_icon.png', 
    './warning_alert.mp3',
    './event_now_alert.mp3'
    // Если у вас есть отдельные CSS/JS файлы, которые не встроены в HTML, добавьте их сюда:
    // './style.css',
    // './script.js', 
];

self.addEventListener('install', event => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Precaching App Shell:', STATIC_ASSETS);
                // Проверяем, если HTML_FILE_NAME это './', то может быть ошибка при кешировании, если это директория
                // Лучше всего явно указать имя файла или убедиться, что сервер отдает index.html для '/'
                let assetsToCache = [...STATIC_ASSETS];
                if (HTML_FILE_NAME === './' && !assetsToCache.find(url => url.endsWith('.html'))) {
                    // Это предположение, что главный файл - index.html
                    // Для большей надежности, пользователь должен явно указать имя HTML файла.
                    // Я оставлю './', но рекомендую пользователю проверить.
                }
                return cache.addAll(assetsToCache.filter(url => url)); // Фильтруем пустые URL, если есть
            })
            .catch(err => {
                console.error('[SW] Precaching failed:', err);
            })
    );
});

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

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Для навигационных запросов (HTML) и статических ассетов: стратегия Cache first, then Network
    if (event.request.mode === 'navigate' || STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.substring(1)))) {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        // console.log('[SW] Serving from static cache:', event.request.url);
                        return cachedResponse;
                    }
                    return fetch(event.request).then(networkResponse => {
                        // Не кешируем ошибки или непрозрачные ответы для статики из сети, если ее нет в кеше
                        if (networkResponse && networkResponse.ok) {
                             const responseToCache = networkResponse.clone();
                             caches.open(CACHE_NAME).then(cache => { // Можно использовать и DYNAMIC_CACHE_NAME
                                 cache.put(event.request, responseToCache);
                             });
                        }
                        return networkResponse;
                    });
                })
        );
    } else {
        // Для других запросов (например, API, если бы они были): Network first, then Cache (или другая стратегия)
        // В данном приложении таких запросов нет, но оставим для примера
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
                .catch(() => caches.match(event.request)) // Отдать из кеша при ошибке сети
        );
    }
});
