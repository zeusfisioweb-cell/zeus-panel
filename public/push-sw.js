self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = typeof data.title === 'string' && data.title.length > 0
    ? data.title
    : 'Zeus Panel';
  const body = typeof data.body === 'string' ? data.body : 'Tienes una nueva actualización.';
  const url = typeof data.url === 'string' ? data.url : '/citas';
  const tag = typeof data.tag === 'string' ? data.tag : 'zeus-panel-alert';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      icon: '/zeus-favicon.png',
      badge: '/zeus-favicon.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/citas';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

