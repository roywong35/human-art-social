import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Conversation, Message

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print(f"🔌 WebSocket connection attempt from user: {self.scope['user']}")
        
        if self.scope["user"].is_anonymous:
            print("❌ Rejecting anonymous user connection")
            await self.close()
        else:
            self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
            self.room_group_name = f"chat_{self.conversation_id}"
            
            print(f"👤 User {self.scope['user'].username} attempting to connect to conversation {self.conversation_id}")
            
            # Check if user is a participant in this conversation
            if await self.is_participant():
                print(f"✅ User is participant, joining room group: {self.room_group_name}")
                # Join room group
                await self.channel_layer.group_add(
                    self.room_group_name,
                    self.channel_name
                )
                await self.accept()
                print(f"✅ WebSocket connection accepted for user {self.scope['user'].username}")
            else:
                print(f"❌ User {self.scope['user'].username} is not a participant in conversation {self.conversation_id}")
                await self.close()

    async def disconnect(self, close_code):
        print(f"🔌 WebSocket disconnection: {close_code}")
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            print(f"👋 Left room group: {self.room_group_name}")

    async def receive(self, text_data):
        """
        Receive message from WebSocket.
        Handle sending chat messages and other actions.
        """
        try:
            text_data_json = json.loads(text_data)
            action = text_data_json.get('action')
            
            print(f"📨 Received WebSocket action: {action} from user {self.scope['user'].username}")
            
            if action == 'send_message':
                content = text_data_json.get('content', '')
                
                if content.strip():
                    print(f"💬 Sending message: '{content}' in conversation {self.conversation_id}")
                    # Save message to database
                    message = await self.save_message(content)
                    
                    if message:
                        print(f"📤 Broadcasting message to room group: {self.room_group_name}")
                        # Send message to room group
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'chat_message',
                                'message': {
                                    'id': message['id'],
                                    'content': message['content'],
                                    'sender': message['sender'],
                                    'created_at': message['created_at'],
                                    'is_read': message['is_read']
                                }
                            }
                        )
                        
            elif action == 'typing':
                is_typing = text_data_json.get('is_typing', False)
                print(f"⌨️ Typing indicator: {is_typing} from user {self.scope['user'].username}")
                # Send typing indicator to room group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'typing_indicator',
                        'user_id': self.scope["user"].id,
                        'username': self.scope["user"].username,
                        'is_typing': is_typing
                    }
                )
                
            elif action == 'mark_as_read':
                message_id = text_data_json.get('message_id')
                if message_id:
                    await self.mark_message_as_read(message_id)
                    
        except json.JSONDecodeError:
            print("❌ Invalid JSON received")
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))

    async def chat_message(self, event):
        """
        Receive chat message from room group
        """
        message = event['message']
        print(f"📤 Sending message to WebSocket client: {message['content']}")

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': message
        }))

    async def typing_indicator(self, event):
        """
        Receive typing indicator from room group
        """
        # Don't send typing indicator to the user who is typing
        if event['user_id'] != self.scope["user"].id:
            await self.send(text_data=json.dumps({
                'type': 'typing_indicator',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing']
            }))

    @database_sync_to_async
    def is_participant(self):
        """
        Check if the current user is a participant in the conversation
        """
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            is_participant = conversation.participants.filter(id=self.scope["user"].id).exists()
            print(f"🔍 Participant check for user {self.scope['user'].username}: {is_participant}")
            return is_participant
        except Conversation.DoesNotExist:
            print(f"❌ Conversation {self.conversation_id} does not exist")
            return False

    @database_sync_to_async
    def save_message(self, content):
        """
        Save message to database
        """
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            message = Message.objects.create(
                conversation=conversation,
                sender=self.scope["user"],
                content=content
            )
            
            print(f"💾 Message saved to database: ID {message.id}")
            
            # Construct absolute URL for profile picture
            profile_picture_url = None
            if message.sender.profile_picture:
                # Build absolute URL for profile picture
                try:
                    profile_picture_url = f"http://localhost:8000{message.sender.profile_picture.url}"
                except:
                    profile_picture_url = None
            
            return {
                'id': message.id,
                'content': message.content,
                'sender': {
                    'id': message.sender.id,
                    'username': message.sender.username,
                    'handle': message.sender.handle,
                    'profile_picture': profile_picture_url
                },
                'created_at': message.created_at.isoformat(),
                'is_read': message.is_read
            }
        except Conversation.DoesNotExist:
            print(f"❌ Conversation {self.conversation_id} does not exist when saving message")
            return None

    @database_sync_to_async
    def mark_message_as_read(self, message_id):
        """
        Mark a message as read
        """
        try:
            message = Message.objects.get(
                id=message_id,
                conversation_id=self.conversation_id
            )
            # Only mark as read if the user is not the sender
            if message.sender != self.scope["user"]:
                message.is_read = True
                message.save()
                return True
        except Message.DoesNotExist:
            return False 