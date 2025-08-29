import json
from channels.generic.websocket import AsyncWebsocketConsumer

class TestWebSocketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            # Accept all connections for testing
            await self.accept()
            
            # Send a test message
            await self.send(text_data=json.dumps({
                'type': 'test_message',
                'message': 'Test WebSocket is working!',
                'timestamp': '2025-08-16'
            }))
        except Exception as e:
            print(f"❌ Error accepting WebSocket: {e}")
            raise

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        try:
            # Echo back the message
            await self.send(text_data=json.dumps({
                'type': 'echo',
                'message': f'Echo: {text_data}',
                'timestamp': '2025-08-16'
            }))
        except Exception as e:
            print(f"❌ Error sending echo: {e}")
            raise
