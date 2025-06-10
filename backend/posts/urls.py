from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, CommentViewSet

router = DefaultRouter()
router.register(r'posts', PostViewSet, basename='post')

urlpatterns = [
    path('', include(router.urls)),

    # Handle-based post URLs
    path('posts/<str:handle>/', PostViewSet.as_view({
        'get': 'get_user_posts_by_handle'
    }), name='user-posts'),
    
    path('posts/<str:handle>/<int:pk>/', PostViewSet.as_view({
        'get': 'retrieve_by_handle',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='user-post-detail'),

    # Post actions
    path('posts/<str:handle>/<int:pk>/like/', PostViewSet.as_view({
        'post': 'like'
    })),
    path('posts/<str:handle>/<int:pk>/repost/', PostViewSet.as_view({
        'post': 'repost'
    })),
    path('posts/<str:handle>/<int:pk>/bookmark/', PostViewSet.as_view({
        'post': 'bookmark'
    })),

    # Feed URLs
    path('feed/', PostViewSet.as_view({
        'get': 'feed'
    })),
    path('explore/', PostViewSet.as_view({
        'get': 'explore'
    })),

    # Bookmark URLs
    path('bookmarks/posts/', PostViewSet.as_view({
        'get': 'bookmarked'
    })),
] 