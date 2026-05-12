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
  const body = typeof data.body === 'string'
    ? data.body
    : 'Tienes una nueva actualización.';
  const url = typeof data.url === 'string' ? data.url : '/citas';
  const tag = typeof data.tag === 'string' ? data.tag : 'zeus-panel-alert';
  const icon = typeof data.icon === 'string' ? data.icon : '/zeus-favicon.png';
  const badge = typeof data.badge === 'string' ? data.badge : '/zeus-favicon.png';
  const renotify = typeof data.renotify === 'boolean' ? data.renotify : true;
  const requireInteraction = typeof data.requireInteraction === 'boolean' ? data.requireInteraction : false;
  const silent = typeof data.silent === 'boolean' ? data.silent : false;
  const timestamp = typeof data.timestampMs === 'number' ? data.timestampMs : Date.now();
  const actions = Array.isArray(data.actions)
    ? data.actions
        .filter((action) => action && typeof action === 'object')
        .map((action) => ({
          action: typeof action.action === 'string' ? action.action : '',
          title: typeof action.title === 'string' ? action.title : '',
        }))
        .filter((action) => action.action.length > 0 && action.title.length > 0)
        .slice(0, 2)
    : [];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify,
      requireInteraction,
      silent,
      icon,
      badge,
      actions,
      timestamp,
      data: {
        ...(data && typeof data === 'object' ? data.data : {}),
        url,
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = typeof event.action === 'string' ? event.action : '';
  const actionUrl = action === 'open_schedule' ? event.notification?.data?.url : undefined;
  const url = typeof actionUrl === 'string'
    ? actionUrl
    : (event.notification?.data?.url || '/citas');

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
