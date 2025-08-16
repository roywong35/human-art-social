import json
from channels.generic.websocket import AsyncWebsocketConsumer

class TestWebSocketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print(f"🧪 Test WebSocket connection attempt!")
        print(f"   Scope: {self.scope}")
        print(f"   Headers: {dict(self.scope.get('headers', []))}")
        print(f"   Query string: {self.scope.get('query_string', b'').decode()}")
        print(f"   Path: {self.scope.get('path', 'No path')}")
        
        try:
            # Accept all connections for testing
            await self.accept()
            print("✅ Test WebSocket connection accepted")
            
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
        print(f"🧪 Test WebSocket disconnected: {close_code}")

    async def receive(self, text_data):
        print(f"🧪 Test WebSocket received: {text_data}")
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
