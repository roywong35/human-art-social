import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()

class ChatNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close()
        else:
            self.user_id = str(self.scope["user"].id)
            self.room_group_name = f"chat_notifications_{self.user_id}"

            # Join room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """
        Handle any incoming messages (currently not needed)
        """
        pass

    async def chat_notification(self, event):
        """
        Receive chat notification from room group and send to WebSocket
        """
        notification = event['notification']

        # Send notification to WebSocket
        await self.send(text_data=json.dumps(notification)) 