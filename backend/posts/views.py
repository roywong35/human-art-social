from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import Post, Comment, EvidenceFile, User
from .serializers import PostSerializer, CommentSerializer
from django.db import models, transaction
from django.utils import timezone
import mimetypes
from django.db.models import Q

# Create your views here.

class PostViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling post operations.
    """
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Get all posts with related data.
        """
        return Post.objects.all().select_related('author').prefetch_related(
            'likes', 'bookmarks', 'reposts', 'comments', 'evidence_files'
        ).order_by('-created_at')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def list(self, request, *args, **kwargs):
        """
        Override list method to ensure consistent response format
        """
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in list method: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching posts'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
            elif mime_type == 'application/x-photoshop':
                return 'psd'
        return 'other'

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Override create method to handle human drawing posts with evidence files
        """
        # Convert string 'true'/'false' to boolean
        is_human_drawing_str = str(self.request.data.get('is_human_drawing', '')).lower()
        is_human_drawing = is_human_drawing_str == 'true'
        
        post_type = self.request.data.get('post_type', 'original')
        evidence_count = int(self.request.data.get('evidence_count', 0))
        
        # Create the post
        post = serializer.save(
            author=self.request.user,
            is_human_drawing=is_human_drawing,
            is_verified=False,
            post_type=post_type
        )

        # Handle evidence files for human drawings
        if is_human_drawing and evidence_count > 0:
            for i in range(evidence_count):
                evidence_file = self.request.FILES.get(f'evidence_file_{i}')
                if evidence_file:
                    EvidenceFile.objects.create(
                        post=post,
                        file=evidence_file,
                        file_type=self.get_file_type(evidence_file)
                    )

    @action(detail=True, methods=['GET'])
    def comments(self, request, pk=None):
        """
        Get comments for a post, with optional parent_id filter for nested comments
        """
        handle = request.query_params.get('handle')
        post = self.get_object()
        
        # Verify handle matches post author if provided
        if handle and post.author.handle != handle:
            return Response(
                {'error': 'Post not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        parent_id = request.query_params.get('parent_id')
        
        # Filter comments based on parent_id
        if parent_id == 'null':
            comments = post.comments.filter(parent_comment__isnull=True)
        else:
            comments = post.comments.filter(parent_comment_id=parent_id)
            
        serializer = CommentSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['GET'], url_path='comments/(?P<comment_id>[^/.]+)')
    def get_comment(self, request, pk=None, comment_id=None):
        """
        Get a specific comment
        """
        post = self.get_object()
        try:
            comment = post.comments.get(id=comment_id)
            serializer = CommentSerializer(comment, context={'request': request})
            return Response(serializer.data)
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['GET'], url_path='comments/(?P<comment_id>[^/.]+)/parent-chain')
    def get_comment_parent_chain(self, request, pk=None, comment_id=None):
        """
        Get the parent chain for a comment
        """
        post = self.get_object()
        try:
            comment = post.comments.get(id=comment_id)
            parent_chain = []
            current = comment.parent_comment
            while current:
                parent_chain.append(current)
                current = current.parent_comment
            
            serializer = CommentSerializer(parent_chain, many=True, context={'request': request})
            return Response(serializer.data)
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['GET'], url_path='comments/(?P<comment_id>[^/.]+)/replies')
    def get_comment_replies(self, request, pk=None, comment_id=None):
        """
        Get replies for a comment
        """
        post = self.get_object()
        try:
            comment = post.comments.get(id=comment_id)
            replies = comment.replies.all()
            serializer = CommentSerializer(replies, many=True, context={'request': request})
            return Response(serializer.data)
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['POST'])
    def comment(self, request, pk=None):
        """
        Add a comment to a post
        """
        post = self.get_object()
        content = request.data.get('content', '').strip()
        parent_comment_id = request.data.get('parent_comment_id')
        
        if not content:
            return Response(
                {'error': 'Content is required for comments'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle nested comments
        parent_comment = None
        if parent_comment_id:
            try:
                parent_comment = Comment.objects.get(id=parent_comment_id, post=post)
            except Comment.DoesNotExist:
                return Response(
                    {'error': 'Parent comment not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )

        comment = Comment.objects.create(
            post=post,
            author=request.user,
            content=content,
            parent_comment=parent_comment
        )
        
        serializer = CommentSerializer(comment, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['POST'], url_path='comments/(?P<comment_id>[^/.]+)/reply')
    def reply_to_comment(self, request, pk=None, comment_id=None):
        """
        Reply to a specific comment
        """
        post = self.get_object()
        content = request.data.get('content', '').strip()
        
        if not content:
            return Response(
                {'error': 'Content is required for replies'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parent_comment = post.comments.get(id=comment_id)
            reply = Comment.objects.create(
                post=post,
                author=request.user,
                content=content,
                parent_comment=parent_comment
            )
            
            serializer = CommentSerializer(reply, context={'request': request})
            return Response(serializer.data)
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Parent comment not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['POST'], url_path='comments/(?P<comment_id>[^/.]+)/like')
    def like_comment(self, request, pk=None, comment_id=None):
        """
        Like or unlike a comment
        """
        post = self.get_object()
        try:
            comment = post.comments.get(id=comment_id)
            if comment.likes.filter(id=request.user.id).exists():
                comment.likes.remove(request.user)
                return Response({'status': 'unliked'})
            else:
                comment.likes.add(request.user)
                return Response({'status': 'liked'})
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['POST'], url_path='comments/(?P<comment_id>[^/.]+)/repost')
    def repost_comment(self, request, pk=None, comment_id=None):
        """
        Repost or unrepost a comment
        """
        post = self.get_object()
        try:
            comment = post.comments.get(id=comment_id)
            if comment.reposts.filter(id=request.user.id).exists():
                comment.reposts.remove(request.user)
                return Response({'status': 'unreposted'})
            else:
                comment.reposts.add(request.user)
                return Response({'status': 'reposted'})
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['POST'], url_path='comments/(?P<comment_id>[^/.]+)/bookmark')
    def bookmark_comment(self, request, pk=None, comment_id=None):
        """
        Bookmark or unbookmark a comment
        """
        post = self.get_object()
        try:
            comment = post.comments.get(id=comment_id)
            if comment.bookmarks.filter(id=request.user.id).exists():
                comment.bookmarks.remove(request.user)
                return Response({'status': 'unbookmarked'})
            else:
                comment.bookmarks.add(request.user)
                return Response({'status': 'bookmarked'})
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['DELETE'], url_path='comments/(?P<comment_id>[^/.]+)')
    def delete_comment(self, request, pk=None, comment_id=None):
        """
        Delete a comment
        """
        post = self.get_object()
        try:
            comment = post.comments.get(
                id=comment_id,
                author=request.user  # Only allow deletion of own comments
            )
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Comment.DoesNotExist:
            return Response(
                {'error': 'Comment not found or you do not have permission to delete it'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['POST'])
    def like(self, request, handle, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=pk, author=user)
        if request.user in post.likes.all():
            post.likes.remove(request.user)
        else:
            post.likes.add(request.user)
        return Response(status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['POST'])
    def repost(self, request, handle, pk=None):
        """
        X-style repost - creates a repost entry while preserving the original post
        """
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=pk, author=user)
        repost = Post.objects.create(
            author=request.user,
            content='',
            post_type='repost',
            referenced_post=post
        )
        serializer = self.get_serializer(repost)
        return Response(serializer.data)

    @action(detail=True, methods=['POST'])
    def quote(self, request, pk=None):
        """
        Quote post - creates a new post with reference to original
        """
        original_post = self.get_object()
        content = request.data.get('content', '').strip()
        
        if not content:
            return Response(
                {'error': 'Content is required for quote posts'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        quote_post = Post.objects.create(
            author=request.user,
            content=content,
            referenced_post=original_post,
            post_type='quote'
        )
        
        serializer = self.get_serializer(quote_post)
        return Response({
            'status': 'quoted',
            'post': serializer.data
        })
    
    @action(detail=True, methods=['POST'])
    def bookmark(self, request, handle, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=pk, author=user)
        if request.user in post.bookmarks.all():
            post.bookmarks.remove(request.user)
        else:
            post.bookmarks.add(request.user)
        return Response(status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['GET'])
    def bookmarked(self, request):
        """
        Get all posts bookmarked by the current user
        """
        try:
            posts = Post.objects.filter(
                bookmarks=request.user
            ).select_related(
                'author'
            ).prefetch_related(
                'likes',
                'bookmarks',
                'reposts',
                'comments',
                'comments__author',
                'comments__bookmarks'
            ).order_by('-created_at')
            
            serializer = self.get_serializer(posts, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in bookmarked view: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching bookmarks'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['POST'], permission_classes=[IsAdminUser])
    def verify_drawing(self, request, pk=None):
        """
        Verify a human drawing post. Only accessible by admin users.
        """
        post = self.get_object()
        
        if not post.is_human_drawing:
            return Response(
                {'error': 'This post is not marked as a human drawing'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if evidence files exist
        if not post.evidence_files.exists():
            return Response(
                {'error': 'This post has no evidence files'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        post.is_verified = True
        post.verification_date = timezone.now()
        post.save()
        
        serializer = self.get_serializer(post)
        return Response(serializer.data)

    def retrieve(self, request, pk=None, *args, **kwargs):
        """
        Override retrieve method to handle both direct ID and handle-based retrieval
        """
        handle = kwargs.get('handle')
        if handle:
            return self.retrieve_by_handle(request, handle, pk)
        try:
            post = self.get_object()
            serializer = self.get_serializer(post)
            return Response(serializer.data)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Post not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    def retrieve_by_handle(self, request, handle=None, pk=None):
        """
        Retrieve a post by handle and post ID
        """
        try:
            post = Post.objects.get(
                author__handle=handle,
                id=pk
            )
            serializer = self.get_serializer(post)
            return Response(serializer.data)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Post not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['GET'])
    def get_user_posts_by_handle(self, request, handle=None):
        """
        Get all posts by a user's handle
        """
        try:
            user = get_object_or_404(User, handle=handle)
            posts = Post.objects.filter(author=user).select_related(
                'author'
            ).prefetch_related(
                'likes',
                'bookmarks',
                'reposts',
                'comments',
                'comments__author',
                'comments__bookmarks'
            ).order_by('-created_at')
            
            serializer = self.get_serializer(posts, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in get_user_posts_by_handle: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching user posts'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['GET'])
    def feed(self, request):
        """
        Get posts from users the current user follows and their own posts
        """
        try:
            following = request.user.following.all()
            posts = Post.objects.filter(
                Q(author__in=following) | Q(author=request.user)
            ).select_related(
                'author',
                'referenced_post',
                'referenced_comment'
            ).prefetch_related(
                'likes',
                'bookmarks',
                'reposts',
                'comments',
                'evidence_files'
            ).order_by('-created_at')
            
            serializer = self.get_serializer(posts, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in feed view: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching feed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['GET'])
    def explore(self, request):
        posts = Post.objects.exclude(author=request.user).order_by('-created_at')
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def bookmarked_posts(self, request):
        posts = Post.objects.filter(bookmarks=request.user).order_by('-created_at')
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def user_posts(self, request, handle):
        user = get_object_or_404(User, handle=handle)
        posts = Post.objects.filter(author=user).order_by('-created_at')
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def user_bookmarked_posts(self, request, handle):
        user = get_object_or_404(User, handle=handle)
        posts = Post.objects.filter(bookmarks=user).order_by('-created_at')
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        posts = Post.objects.filter(
            Q(content__icontains=query) |
            Q(author__username__icontains=query) |
            Q(author__handle__icontains=query)
        ).order_by('-created_at')
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)

class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Comment.objects.all().order_by('-created_at')

    def list(self, request, handle, post_id):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        comments = Comment.objects.filter(post=post, parent_comment=None).order_by('-created_at')
        serializer = self.get_serializer(comments, many=True)
        return Response(serializer.data)

    def retrieve(self, request, handle, post_id, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        comment = get_object_or_404(Comment, id=pk, post=post)
        serializer = self.get_serializer(comment)
        return Response(serializer.data)

    def create(self, request, handle, post_id):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user, post=post)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def parent_chain(self, request, handle, post_id, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        comment = get_object_or_404(Comment, id=pk, post=post)
        
        parent_chain = []
        current = comment.parent_comment
        while current:
            parent_chain.append(current)
            current = current.parent_comment
        
        serializer = self.get_serializer(parent_chain, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def like(self, request, handle, post_id, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        comment = get_object_or_404(Comment, id=pk, post=post)
        if request.user in comment.likes.all():
            comment.likes.remove(request.user)
        else:
            comment.likes.add(request.user)
        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def repost(self, request, handle, post_id, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        comment = get_object_or_404(Comment, id=pk, post=post)
        repost = Post.objects.create(
            author=request.user,
            content='',
            post_type='repost',
            referenced_comment=comment
        )
        serializer = PostSerializer(repost)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def bookmark(self, request, handle, post_id, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        comment = get_object_or_404(Comment, id=pk, post=post)
        if request.user in comment.bookmarks.all():
            comment.bookmarks.remove(request.user)
        else:
            comment.bookmarks.add(request.user)
        return Response(status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def list_replies(self, request, handle, post_id, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        comment = get_object_or_404(Comment, id=pk, post=post)
        replies = Comment.objects.filter(parent_comment=comment).order_by('-created_at')
        serializer = self.get_serializer(replies, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def create_reply(self, request, handle, post_id, pk=None):
        user = get_object_or_404(User, handle=handle)
        post = get_object_or_404(Post, id=post_id, author=user)
        parent_comment = get_object_or_404(Comment, id=pk, post=post)
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user, post=post, parent_comment=parent_comment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def bookmarked_comments(self, request):
        comments = Comment.objects.filter(bookmarks=request.user).order_by('-created_at')
        serializer = self.get_serializer(comments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def user_comments(self, request, handle):
        user = get_object_or_404(User, handle=handle)
        comments = Comment.objects.filter(author=user).order_by('-created_at')
        serializer = self.get_serializer(comments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def user_bookmarked_comments(self, request, handle):
        user = get_object_or_404(User, handle=handle)
        comments = Comment.objects.filter(bookmarks=user).order_by('-created_at')
        serializer = self.get_serializer(comments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        comments = Comment.objects.filter(
            Q(content__icontains=query) |
            Q(author__username__icontains=query) |
            Q(author__handle__icontains=query)
        ).order_by('-created_at')
        serializer = self.get_serializer(comments, many=True)
        return Response(serializer.data)
