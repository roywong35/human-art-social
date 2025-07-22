from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from ..models import Post, PostImage, Draft, DraftImage
from ..serializers import DraftSerializer
from django.db import transaction
import mimetypes


class DraftPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class DraftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling draft operations.
    """
    serializer_class = DraftSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DraftPagination

    def get_queryset(self):
        """
        Get drafts for the current user only
        """
        return Draft.objects.filter(author=self.request.user).prefetch_related('images')

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
        Create draft with associated images
        """
        # Create the draft
        draft = serializer.save(author=self.request.user)
        print(f"📝 Draft created: {draft.id}")

        # Handle multiple images
        for key in self.request.FILES:
            if key.startswith('image_'):
                image = self.request.FILES[key]
                order = int(key.split('_')[1]) if '_' in key else 0
                DraftImage.objects.create(
                    draft=draft,
                    image=image,
                    order=order
                )

        print(f"📝 Draft {draft.id} created with {draft.images.count()} images")

    @transaction.atomic  
    def perform_update(self, serializer):
        """
        Update draft and handle image updates
        """
        draft = serializer.save()
        
        # Handle image updates if new images are provided
        if self.request.FILES:
            # For simplicity, we'll replace all images
            # In a production app, you might want more sophisticated image management
            draft.images.all().delete()  # Remove old images
            
            # Add new images
            for key in self.request.FILES:
                if key.startswith('image_'):
                    image = self.request.FILES[key]
                    order = int(key.split('_')[1]) if '_' in key else 0
                    DraftImage.objects.create(
                        draft=draft,
                        image=image,
                        order=order
                    )

    @action(detail=True, methods=['POST'])
    def publish(self, request, pk=None):
        """
        Convert a draft to a published post
        """
        draft = self.get_object()
        
        try:
            with transaction.atomic():
                # Create the post from draft data
                post_data = {
                    'content': draft.content,
                    'post_type': draft.post_type,
                    'is_human_drawing': draft.is_human_drawing,
                }
                
                if draft.scheduled_time:
                    post_data['scheduled_time'] = draft.scheduled_time
                if draft.parent_post:
                    post_data['parent_post'] = draft.parent_post
                    post_data['parent_post_author_handle'] = draft.parent_post.author.handle
                    post_data['parent_post_author_username'] = draft.parent_post.author.username
                
                # Create the post
                post = Post.objects.create(
                    author=request.user,
                    **post_data
                )
                
                # Copy images from draft to post
                for draft_image in draft.images.all():
                    PostImage.objects.create(
                        post=post,
                        image=draft_image.image,
                        order=draft_image.order
                    )
                
                # Delete the draft since it's now published
                draft.delete()
                
                # Return the created post
                from ..serializers import UserPostSerializer
                post_serializer = UserPostSerializer(post, context={'request': request})
                return Response(post_serializer.data, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            print(f"❌ Error publishing draft {draft.id}: {str(e)}")
            return Response(
                {'error': 'Failed to publish draft'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
