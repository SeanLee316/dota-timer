// sw.js
const CACHE_NAME = 'dota-timer-cache-v9'; // Изменяйте версию при обновлении файлов
const urlsToCache = [
    './', // Главная страница (index.html или как назван ваш файл)
    './dota_timer.html', // Укажите ТОЧНОЕ имя вашего HTML файла здесь
    // Если у вас есть отдельные CSS или JS файлы, добавьте их пути сюда
    // مثلا: './style.css', './script.js'
    './dota_icon.png',
    './warning_alert.mp3',
    './event_now_alert.mp3'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('ServiceWorker: Cache opened');
                return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'}))); // Форсируем обновление из сети при установке
            })
            .catch(err => {
                console.error('ServiceWorker: Failed to cache on install:', err);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // Возвращаем из кеша, если есть
                }
                // Если нет в кеше, идем в сеть
                return fetch(event.request).then(
                    function(response) {
                        // Проверяем, что мы получили валидный ответ
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Клонируем ответ, т.к. response - это Stream и его можно использовать один раз
                        var responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('ServiceWorker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
