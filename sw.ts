self.addEventListener('push', function(event) {
  const data = event.data.json();
  const options = {
    body: data.message,
    icon: 'path/to/icon.png',
    badge: 'path/to/badge.png'
  };
  event.waitUntil(
    self.registration.showNotification('New Message', options)
  );
});