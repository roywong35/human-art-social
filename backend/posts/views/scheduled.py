from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from posts.views.draft import DraftPagination


from ..models import Post, PostImage, ScheduledPost, ScheduledPostImage
from ..serializers import ScheduledPostSerializer
from django.db import transaction
from django.utils import timezone
import mimetypes


class ScheduledPostViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling scheduled post operations.
    """
    serializer_class = ScheduledPostSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DraftPagination

    def get_queryset(self):
        """
        Get scheduled posts for the current user only
        """
        return ScheduledPost.objects.filter(author=self.request.user).prefetch_related('images')

    def get_file_type(self, file):
        """
        Determine the type of file based on its MIME type
        """
        mime_type = mimetypes.guess_type(file.name)[0]
        if mime_type:
            if mime_type.startswith('image/'):
                return 'image'
            elif mime_type.startswith('video/'):
                return 'video'
        return 'other'

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Create scheduled post with associated images
        """
        # Create the scheduled post
        scheduled_post = serializer.save(author=self.request.user)


        # Handle multiple images
        for key in self.request.FILES:
            if key.startswith('image_'):
                image = self.request.FILES[key]
                order = int(key.split('_')[1]) if '_' in key else 0
                ScheduledPostImage.objects.create(
                    scheduled_post=scheduled_post,
                    image=image,
                    order=order
                )



    @transaction.atomic
    def perform_update(self, serializer):
        """
        Update scheduled post and handle image updates
        """
        scheduled_post = serializer.save()
        
        # Handle image updates if new images are provided
        if self.request.FILES:
            # For simplicity, we'll replace all images
            scheduled_post.images.all().delete()  # Remove old images
            
            # Add new images
            for key in self.request.FILES:
                if key.startswith('image_'):
                    image = self.request.FILES[key]
                    order = int(key.split('_')[1]) if '_' in key else 0
                    ScheduledPostImage.objects.create(
                        scheduled_post=scheduled_post,
                        image=image,
                        order=order
                    )

    @action(detail=True, methods=['POST'])
    def publish_now(self, request, pk=None):
        """
        Immediately publish a scheduled post
        """
        scheduled_post = self.get_object()
        
        if scheduled_post.status != 'scheduled':
            return Response(
                {'error': 'This scheduled post cannot be published'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                # Create the post from scheduled post data
                post_data = {
                    'content': scheduled_post.content,
                    'post_type': scheduled_post.post_type,
                    'is_human_drawing': scheduled_post.is_human_drawing,
                }
                
                if scheduled_post.parent_post:
                    post_data['parent_post'] = scheduled_post.parent_post
                    post_data['parent_post_author_handle'] = scheduled_post.parent_post.author.handle
                    post_data['parent_post_author_username'] = scheduled_post.parent_post.author.username
                
                # Create the post (no scheduled_time = published immediately)
                post = Post.objects.create(
                    author=request.user,
                    **post_data
                )
                
                # Copy images from scheduled post to post
                for scheduled_image in scheduled_post.images.all():
                    PostImage.objects.create(
                        post=post,
                        image=scheduled_image.image,
                        order=scheduled_image.order
                    )
                
                # Update scheduled post status
                scheduled_post.status = 'sent'
                scheduled_post.published_post = post
                scheduled_post.save()
                
                # Return the created post
                from ..serializers import UserPostSerializer
                post_serializer = UserPostSerializer(post, context={'request': request})
                return Response(post_serializer.data, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            print(f"❌ Error publishing scheduled post {scheduled_post.id}: {str(e)}")
            return Response(
                {'error': 'Failed to publish scheduled post'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['GET'])
    def due(self, request):
        """
        Get scheduled posts that are due to be published
        """
        due_posts = ScheduledPost.objects.filter(
            status='scheduled',
            scheduled_time__lte=timezone.now()
        ).prefetch_related('images')
        
        serializer = self.get_serializer(due_posts, many=True)
        return Response(serializer.data)
