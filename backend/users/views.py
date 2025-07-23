from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count
from .serializers import UserCreateSerializer, UserProfileSerializer, UserUpdateSerializer, UserSerializer, ChangePasswordSerializer
from posts.serializers import PostSerializer
from posts.models import Post
from notifications.services import create_follow_notification

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling user operations including registration and profile management.
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()

    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """
        Get the base queryset for the viewset.
        """
        return User.objects.all().prefetch_related('followers', 'following')

    def retrieve(self, request, handle=None):
        user = get_object_or_404(User, handle=handle)
        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def follow(self, request, handle=None):
        """
        Follow or unfollow a user
        """
        user = get_object_or_404(User, handle=handle)
        was_following = request.user in user.followers.all()
        
        if was_following:
            user.followers.remove(request.user)
        else:
            user.followers.add(request.user)
            # Create notification for the follow
            create_follow_notification(request.user, user)
            
        # Refresh the user instance to get updated counts
        user.refresh_from_db()
        serializer = UserProfileSerializer(user, context={'request': request})
        return Response({
            **serializer.data,
            'is_following': not was_following  # Return the new follow state
        })

    @action(detail=True, methods=['get'])
    def followers(self, request, handle=None):
        user = get_object_or_404(User, handle=handle)
        followers = user.followers.all()
        serializer = self.get_serializer(followers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def following(self, request, handle=None):
        user = get_object_or_404(User, handle=handle)
        following = user.following.all()
        serializer = self.get_serializer(following, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def posts(self, request, handle=None):
        try:
            # Get the user and handle 404 if not found
            user = get_object_or_404(User, handle=handle)
            
            # Get posts with all related data
            posts = Post.objects.filter(author=user).select_related(
                'author',
                'referenced_post',
                'parent_post'
            ).prefetch_related(
                'likes',
                'bookmarks',
                'reposts',
                'replies',
                'evidence_files'
            ).order_by('-created_at')
            
            # Serialize with request context
            serializer = PostSerializer(posts, many=True, context={'request': request})
            return Response(serializer.data)
            
        except Exception as e:
            print(f"Error in posts view: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching posts'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def liked_posts(self, request, handle=None):
        user = get_object_or_404(User, handle=handle)
        posts = Post.objects.filter(likes=user).order_by('-created_at')
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def bookmarked_posts(self, request, handle=None):
        user = get_object_or_404(User, handle=handle)
        posts = Post.objects.filter(bookmarks=user).order_by('-created_at')
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        users = User.objects.filter(
            Q(username__icontains=query) |
            Q(handle__icontains=query)
        ).order_by('-date_joined')
        serializer = UserProfileSerializer(users, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """
        Get or update the current user's profile
        """
        if request.method == 'GET':
            serializer = UserProfileSerializer(request.user, context={'request': request})
            return Response(serializer.data)
        
        # PATCH method
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserProfileSerializer(request.user, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def suggested(self, request):
        """
        Get recommended users based on follower count
        """
        # Exclude the current user, users they already follow, and staff/admin users
        current_user = request.user
        following_users = current_user.following.all()
        
        users = User.objects.exclude(
            Q(id=current_user.id) | 
            Q(id__in=following_users) |
            Q(is_staff=True) |
            Q(is_superuser=True)
        ).annotate(
            follower_count=Count('followers')
        ).order_by('-follower_count')[:5]  # Get top 5 users by follower count
        
        serializer = UserProfileSerializer(users, many=True, context={'request': request})
        return Response(serializer.data)

    def get_serializer_class(self):
        """
        Returns the appropriate serializer class based on the action.
        """
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        if self.action in ['list', 'retrieve', 'me']:
            return UserProfileSerializer
        return UserCreateSerializer

    def update(self, request, handle=None, *args, **kwargs):
        """
        Handle user profile updates and return full profile data.
        """
        instance = get_object_or_404(User, handle=handle)
        
        # Check if user is trying to update their own profile
        if request.user != instance:
            return Response(
                {'error': 'You can only update your own profile.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Return full profile data after update
        return Response(UserProfileSerializer(instance).data)

    def create(self, request, *args, **kwargs):
        """
        Create a new user and return JWT tokens.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserProfileSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def verify_artist(self, request, pk=None):
        """
        Endpoint for admin users to verify artists.
        Requires admin privileges.
        """
        user = self.get_object()
        if not user.is_artist:
            return Response(
                {'error': 'This user is not registered as an artist.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.verified_artist = True
        user.save()
        return Response(
            {'message': f'Artist {user.username} has been verified.'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """
        Change the password for the current user.
        Requires the current password and new password.
        """
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            current_password = serializer.validated_data['current_password']
            new_password = serializer.validated_data['new_password']

            # Check if current password is correct
            if not user.check_password(current_password):
                return Response(
                    {'current_password': ['Wrong password.']},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Set new password
            user.set_password(new_password)
            user.save()

            return Response({'message': 'Password changed successfully.'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
