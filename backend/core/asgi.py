"""
ASGI config for core project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
import django
from django.core.asgi import get_asgi_application

# Set Django settings module FIRST
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Initialize Django BEFORE importing anything that uses models
django.setup()

# FORCE storage reload for Daphne/ASGI
from django.conf import settings
import django.core.files.storage

# Clear ALL cached storage instances
cache_attrs = ['_default_storage', '_storages', 'default_storage']
for attr in cache_attrs:
    if hasattr(django.core.files.storage, attr):
        delattr(django.core.files.storage, attr)
        print(f"🔄 ASGI: Cleared storage cache: {attr}")

# Force reload default_storage
if hasattr(settings, 'DEFAULT_FILE_STORAGE'):
    print(f"🔄 ASGI: DEFAULT_FILE_STORAGE = {settings.DEFAULT_FILE_STORAGE}")
    
    # Import and set the correct storage
    from django.utils.module_loading import import_string
    storage_class = import_string(settings.DEFAULT_FILE_STORAGE)
    new_storage = storage_class()
    django.core.files.storage._default_storage = new_storage
    print(f"🔄 ASGI: Forced storage to {new_storage.__class__.__name__}")

# Now we can safely import consumers and other Django components
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import path
from notifications.consumers import NotificationConsumer
from chat.consumers import ChatConsumer
from chat.chat_notification_consumer import ChatNotificationConsumer
from chat.middleware import TokenAuthMiddlewareStack
from .test_websocket import TestWebSocketConsumer

# Get the Django ASGI application (for HTTP)
django_asgi_app = get_asgi_application()

print("🚀 ASGI Application Starting...")
print("   WebSocket Routes:")
print("   - /ws/test/ (TEST ROUTE)")
print("   - /ws/notifications/")
print("   - /ws/chat/<int:conversation_id>/")
print("   - /ws/chat_notifications/")

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        URLRouter([
            path('ws/test/', TestWebSocketConsumer.as_asgi()),  # Test route - NO authentication
            path('ws/notifications/', TokenAuthMiddlewareStack(NotificationConsumer.as_asgi())),
            path('ws/chat/<int:conversation_id>/', TokenAuthMiddlewareStack(ChatConsumer.as_asgi())),
            path('ws/chat_notifications/', TokenAuthMiddlewareStack(ChatNotificationConsumer.as_asgi())),
        ])
    ),
})

print("✅ ASGI Application Configured Successfully")
