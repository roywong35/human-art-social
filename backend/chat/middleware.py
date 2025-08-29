from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from urllib.parse import parse_qs
import jwt
from django.conf import settings

User = get_user_model()

@database_sync_to_async
def get_user_from_jwt(token_string):
    try:
        # Decode the JWT token
        token = AccessToken(token_string)
        user_id = token.get('user_id')
        
        if not user_id:
            print(f"❌ JWT token missing user_id")
            return AnonymousUser()
        
        user = User.objects.get(id=user_id)

        return user
        
    except InvalidToken as e:
        print(f"❌ JWT token invalid: {e}")
        return AnonymousUser()
    except TokenError as e:
        print(f"❌ JWT token error: {e}")
        return AnonymousUser()
    except User.DoesNotExist as e:
        print(f"❌ User not found: {e}")
        return AnonymousUser()
    except KeyError as e:
        print(f"❌ JWT token missing key: {e}")
        return AnonymousUser()
    except Exception as e:
        print(f"❌ Unexpected JWT authentication error: {e}")
        return AnonymousUser()

class TokenAuthMiddleware(BaseMiddleware):
    def __init__(self, inner):
        super().__init__(inner)

    async def __call__(self, scope, receive, send):
        try:
            # Get token from query parameters
            query_params = parse_qs(scope["query_string"].decode())
            token_string = query_params.get("token", [None])[0]
            
            if token_string:

                scope["user"] = await get_user_from_jwt(token_string)
                
                if scope["user"].is_anonymous:
                    print(f"❌ WebSocket authentication failed - user is anonymous")

            else:
                scope["user"] = AnonymousUser()
                print("❌ No token provided for WebSocket connection")
        except Exception as e:
            print(f"❌ WebSocket authentication error: {e}")
            scope["user"] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)

def TokenAuthMiddlewareStack(inner):
    return TokenAuthMiddleware(inner) 