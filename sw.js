// sw.js

const CACHE_NAME = 'dota2-timer-cache-v1.1'; // Обновите версию при изменениях в файлах для кеширования!
const DYNAMIC_CACHE_NAME = 'dota2-timer-dynamic-v1.1';

// Список файлов для ОБЯЗАТЕЛЬНОГО кеширования при установке Service Worker
// Замените 'index.html' на имя вашего основного HTML файла, если оно другое.
const STATIC_ASSETS = [
    './', // Это кеширует главную страницу (index.html в корне)
    // Если ваш HTML файл называется иначе, укажите его: например, './dota_timer_v8.html'
    // Если у вас есть отдельные CSS/JS файлы, добавьте их сюда:
    // './style.css',
    // './script.js', 
    './dota_icon.png', // Убедитесь, что путь правильный
    './warning_alert.mp3',
    './event_now_alert.mp3'
];

// Установка Service Worker: кеширование статических ассетов
self.addEventListener('install', event => {
    console.log('[SW] Installing Service Worker...', event);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Precaching App Shell:', STATIC_ASSETS);
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(err => {
                console.error('[SW] Precaching failed:', err);
            })
    );
});

// Активация Service Worker: очистка старых кешей
self.addEventListener('activate', event => {
    console.log('[SW] Activating Service Worker...', event);
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
    return self.clients.claim(); // Позволяет SW начать контролировать страницу сразу после активации
});

// Обработка запросов Fetch: стратегия "Cache then Network" для статики, "Network then Cache" для динамики
self.addEventListener('fetch', event => {
    // Для статических ассетов из списка STATIC_ASSETS - сначала кеш, потом сеть
    if (STATIC_ASSETS.includes(event.request.url.replace(self.location.origin, '.'))) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request).then(fetchRes => {
                        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                            // Не кешируем ошибки или непрозрачные ответы
                            if (fetchRes.ok || fetchRes.type === 'opaque') {
                                cache.put(event.request.url, fetchRes.clone());
                            }
                            return fetchRes;
                        });
                    });
                })
        );
    } else {
        // Для других запросов (если есть) - сначала сеть, потом кеш
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Проверяем, что мы получили валидный ответ
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        // Если из сети не пришло, пробуем достать из динамического кеша
                        return caches.match(event.request).then(cacheResponse => {
                            return cacheResponse || response; // Возвращаем из кеша если есть, иначе ответ из сети (даже если плохой)
                        });
                    }
                    const responseToCache = response.clone();
                    caches.open(DYNAMIC_CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    return response;
                })
                .catch(() => {
                    // Если сеть недоступна, пытаемся отдать из кеша
                    return caches.match(event.request);
                })
        );
    }
});
