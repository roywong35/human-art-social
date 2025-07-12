import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print(f"🔔 [NOTIFICATION CONSUMER] Connection attempt from user: {self.scope['user']}")
        print(f"🔔 [NOTIFICATION CONSUMER] User type: {type(self.scope['user'])}")
        print(f"🔔 [NOTIFICATION CONSUMER] User authenticated: {not self.scope['user'].is_anonymous}")
        
        if self.scope["user"].is_anonymous:
            print("❌ [NOTIFICATION CONSUMER] Rejecting anonymous user notification connection")
            await self.close()
        else:
            self.user_id = str(self.scope["user"].id)
            self.room_group_name = f"notifications_{self.user_id}"
            
            print(f"👤 [NOTIFICATION CONSUMER] User {self.scope['user'].username} (ID: {self.user_id}) connecting to notifications: {self.room_group_name}")

            try:
                # Join room group
                await self.channel_layer.group_add(
                    self.room_group_name,
                    self.channel_name
                )
                await self.accept()
                print(f"✅ [NOTIFICATION CONSUMER] WebSocket connection accepted for user {self.scope['user'].username}")
                print(f"✅ [NOTIFICATION CONSUMER] User added to group: {self.room_group_name}")
            except Exception as e:
                print(f"❌ [NOTIFICATION CONSUMER] Error during connection: {str(e)}")
                import traceback
                traceback.print_exc()
                await self.close()

    async def disconnect(self, close_code):
        print(f"🔔 Notification WebSocket disconnection: {close_code}")
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            print(f"👋 Left notification group: {self.room_group_name}")

    async def receive(self, text_data):
        """
        Receive message from WebSocket.
        Currently used for marking notifications as read.
        """
        try:
            text_data_json = json.loads(text_data)
            action = text_data_json.get('action')
            
            if action == 'mark_as_read':
                notification_id = text_data_json.get('notification_id')
                if notification_id:
                    await self.mark_notification_as_read(notification_id)
                    await self.send(text_data=json.dumps({
                        'status': 'success',
                        'message': 'Notification marked as read'
                    }))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'status': 'error',
                'message': 'Invalid JSON format'
            }))

    async def notification_message(self, event):
        """
        Receive notification from room group
        """
        message = event['message']
        print(f"📤 [NOTIFICATION CONSUMER] Received notification for user {self.scope['user'].username}: {message}")
        print(f"📤 [NOTIFICATION CONSUMER] Event: {event}")

        try:
            # Send message to WebSocket
            await self.send(text_data=json.dumps(message))
            print(f"📤 [NOTIFICATION CONSUMER] Successfully sent notification to WebSocket")
        except Exception as e:
            print(f"❌ [NOTIFICATION CONSUMER] Error sending notification to WebSocket: {str(e)}")
            import traceback
            traceback.print_exc()

    @database_sync_to_async
    def mark_notification_as_read(self, notification_id):
        from .models import Notification
        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient=self.scope["user"]
            )
            notification.is_read = True
            notification.save()
            return True
        except Notification.DoesNotExist:
            return False 