import json
from channels.generic.websocket import AsyncWebsocketConsumer

class TestWebSocketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print(f"🧪 Test WebSocket connection attempt from: {self.scope}")
        print(f"   Headers: {dict(self.scope.get('headers', []))}")
        print(f"   Query string: {self.scope.get('query_string', b'').decode()}")
        
        # Accept all connections for testing
        await self.accept()
        print("✅ Test WebSocket connection accepted")
        
        # Send a test message
        await self.send(text_data=json.dumps({
            'type': 'test_message',
            'message': 'Test WebSocket is working!'
        }))

    async def disconnect(self, close_code):
        print(f"🧪 Test WebSocket disconnected: {close_code}")

    async def receive(self, text_data):
        print(f"🧪 Test WebSocket received: {text_data}")
        # Echo back the message
        await self.send(text_data=json.dumps({
            'type': 'echo',
            'message': f'Echo: {text_data}'
        }))
