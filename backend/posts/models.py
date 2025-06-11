from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
import os
import uuid
from django.utils import timezone

User = get_user_model()

def post_image_path(instance, filename):
    # Get the file extension
    ext = filename.split('.')[-1]
    # Generate a unique filename using UUID
    filename = f"{uuid.uuid4()}.{ext}"
    # Return the upload path
    return os.path.join('post_images', filename)

def evidence_file_path(instance, filename):
    # Get the file extension
    ext = filename.split('.')[-1]
    # Generate a unique filename using UUID
    filename = f"{uuid.uuid4()}.{ext}"
    # Return the upload path
    return os.path.join('evidence_files', filename)

class EvidenceFile(models.Model):
    """
    Model for evidence files that prove a post is human-created art.
    """
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='evidence_files')
    file = models.FileField(upload_to=evidence_file_path)
    file_type = models.CharField(max_length=20)  # e.g., 'image', 'video', 'psd'
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Evidence for post {self.post.id}"

class PostImage(models.Model):
    """
    Model for storing multiple images per post
    """
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to=post_image_path)
    order = models.IntegerField(default=0)  # To maintain image order
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Image {self.order} for post {self.post.id}"

class Post(models.Model):
    """
    Model for user posts in the social platform.
    """
    POST_TYPES = (
        ('post', 'Post'),
        ('repost', 'Repost'),
        ('quote', 'Quote'),
    )
    
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(blank=True)
    # Deprecating single image field in favor of PostImage relation
    image = models.ImageField(upload_to='posts/', blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    post_type = models.CharField(max_length=15, choices=POST_TYPES, default='post')
    referenced_post = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reposts')
    referenced_comment = models.ForeignKey('Comment', on_delete=models.SET_NULL, null=True, blank=True, related_name='reposts')
    likes = models.ManyToManyField(User, related_name='liked_posts', blank=True)
    bookmarks = models.ManyToManyField(User, related_name='bookmarked_posts', blank=True)
    media = models.JSONField(default=list, blank=True)
    
    # Human drawing fields
    is_human_drawing = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    verification_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f'{self.author.username} - {self.content[:50]}'
    
    @property
    def likes_count(self):
        return self.likes.count()
    
    @property
    def comments_count(self):
        return self.comments.count()

    @property
    def reposts_count(self):
        return self.reposts.count()

    @property
    def total_reposts(self):
        return self.reposts.count()

    @property
    def is_repost(self):
        return self.post_type == 'repost'

    @property
    def is_quote(self):
        return self.post_type == 'quote'

    def get_absolute_url(self):
        return f'/{self.author.handle}/post/{self.id}/'

    @property
    def total_comments_count(self):
        """Count all comments including replies (for reference if needed)"""
        return self.comments.count()
    
    @property
    def short_content(self):
        return self.content[:100] + '...' if len(self.content) > 100 else self.content

    def is_liked_by(self, user):
        return self.likes.filter(id=user.id).exists()

    def is_reposted_by(self, user):
        return self.reposts.filter(id=user.id).exists()

class Comment(models.Model):
    """
    Model for comments on posts.
    """
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    parent_comment = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    likes = models.ManyToManyField(User, related_name='liked_comments', blank=True)
    bookmarks = models.ManyToManyField(User, related_name='bookmarked_comments', blank=True)
    media = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.author.username} - {self.content[:50]}'

    @property
    def likes_count(self):
        return self.likes.count()

    @property
    def replies_count(self):
        return self.replies.count()

    @property
    def reposts_count(self):
        return self.reposts.count()

    def is_liked_by(self, user):
        return self.likes.filter(id=user.id).exists()

    def is_reposted_by(self, user):
        return self.reposts.filter(id=user.id).exists()

    def is_bookmarked_by(self, user):
        return self.bookmarks.filter(id=user.id).exists()

    def get_absolute_url(self):
        return f'/{self.post.author.handle}/post/{self.post.id}/comment/{self.id}/'
