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

# Now we can safely import consumers and other Django components
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import path
from notifications.consumers import NotificationConsumer
from chat.consumers import ChatConsumer
from chat.middleware import TokenAuthMiddlewareStack

# Get the Django ASGI application (for HTTP)
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        TokenAuthMiddlewareStack(
            URLRouter([
                path('ws/notifications/', NotificationConsumer.as_asgi()),
                path('ws/chat/<int:conversation_id>/', ChatConsumer.as_asgi()),
            ])
        )
    ),
})
