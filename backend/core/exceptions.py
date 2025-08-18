from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()

def custom_exception_handler(exc, context):
    """
    Custom exception handler to provide better error messages for authentication failures
    """
    # Call the default exception handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # Handle authentication errors specifically
        if response.status_code == 401:
            # Check if this is a login attempt with invalid credentials
            request = context.get('request')
            if request and request.method == 'POST' and 'token/' in request.path:
                # This is a login attempt
                email = request.data.get('email', '')
                password = request.data.get('password', '')
                
                if email and password:
                    # Check if user exists
                    try:
                        user = User.objects.get(email=email)
                        if not user.is_active:
                            response.data = {
                                'detail': 'This account has been deactivated. Please contact support.'
                            }
                        else:
                            # User exists and is active, so password must be wrong
                            response.data = {
                                'detail': 'Incorrect password. Please try again.'
                            }
                    except User.DoesNotExist:
                        # User doesn't exist
                        response.data = {
                            'detail': 'No account found with this email address.'
                        }
                else:
                    response.data = {
                        'detail': 'Please provide both email and password.'
                    }
    
    return response
