from django.urls import path
from .views import UserViewSet

urlpatterns = [
    # Registration endpoint
    path('', UserViewSet.as_view({
        'post': 'create'
    }), name='user-register'),

    # User profile endpoints
    path('handle/<str:handle>/', UserViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='user-detail'),

    # Posts endpoints
    path('handle/<str:handle>/posts/', UserViewSet.as_view({
        'get': 'posts'
    }), name='user-posts'),

    # Social endpoints
    path('handle/<str:handle>/follow/', UserViewSet.as_view({
        'post': 'follow'
    }), name='user-follow'),
    path('handle/<str:handle>/followers/', UserViewSet.as_view({
        'get': 'followers'
    }), name='user-followers'),
    path('handle/<str:handle>/following/', UserViewSet.as_view({
        'get': 'following'
    }), name='user-following'),

    # User utility endpoints
    path('search/', UserViewSet.as_view({
        'get': 'search'
    }), name='user-search'),
    path('me/', UserViewSet.as_view({
        'get': 'me',
        'patch': 'me'
    }), name='user-me'),
    path('suggested/', UserViewSet.as_view({
        'get': 'suggested'
    }), name='user-suggested'),

    # Password change endpoint
    path('change-password/', UserViewSet.as_view({
        'post': 'change_password'
    }), name='user-change-password'),
] 