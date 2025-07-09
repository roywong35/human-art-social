from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
import os
import uuid
from django.utils import timezone
import re

User = get_user_model()

def post_image_path(instance, filename):
    # Get the file extension
    ext = filename.split('.')[-1]
    # Generate a unique filename using UUID
    filename = f"{uuid.uuid4()}.{ext}"
    # Return the upload path using the same path as the old image field
    return os.path.join('posts', filename)

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

class Hashtag(models.Model):
    name = models.CharField(max_length=100, unique=True)  # Stored in lowercase
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        self.name = self.name.lower()  # Force lowercase
        super().save(*args, **kwargs)

    def __str__(self):
        return f'#{self.name}'

    class Meta:
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['created_at'])
        ]

class PostHashtag(models.Model):
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='post_hashtags')
    hashtag = models.ForeignKey(Hashtag, on_delete=models.CASCADE, related_name='post_hashtags')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['post', 'hashtag']  # Prevent duplicates
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['hashtag', 'created_at'])  # For trending queries
        ]

class Post(models.Model):
    """
    Model for user posts in the social platform.
    A post can be a regular post, a comment (reply to another post),
    a repost, or a quote post.
    """
    POST_TYPES = (
        ('post', 'Post'),
        ('reply', 'Reply'),
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
    parent_post = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    referenced_post = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reposts')
    likes = models.ManyToManyField(User, related_name='liked_posts', blank=True)
    reposters = models.ManyToManyField(User, related_name='reposted_posts', blank=True)
    bookmarks = models.ManyToManyField(User, related_name='bookmarked_posts', blank=True)
    media = models.JSONField(default=list, blank=True)
    conversation_chain = models.JSONField(default=list, blank=True, help_text='Ordered list of post IDs in the conversation chain')
    reposted_at = models.DateTimeField(null=True, blank=True, help_text='When this post was reposted by the current user')
    
    # Parent post author fields for replies (for faster lookups in search)
    parent_post_author_handle = models.CharField(max_length=50, blank=True, null=True, help_text='Handle of the parent post author for replies')
    parent_post_author_username = models.CharField(max_length=100, blank=True, null=True, help_text='Username of the parent post author for replies')
    
    # Human drawing fields
    is_human_drawing = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    verification_date = models.DateTimeField(null=True, blank=True)

    # Scheduled posts field
    scheduled_time = models.DateTimeField(
        null=True, 
        blank=True, 
        help_text="When this post should be published. If null, post is published immediately."
    )

    hashtags = models.ManyToManyField(Hashtag, through=PostHashtag, related_name='posts')
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f'{self.author.username} - {self.content[:50]}'
    
    @property
    def likes_count(self):
        if self.post_type == 'repost' and self.referenced_post:
            return self.referenced_post.likes.count()
        return self.likes.count()
    
    @property
    def replies_count(self):
        return self.replies.count()

    @property
    def reposts_count(self):
        if self.post_type == 'repost' and self.referenced_post:
            return self.referenced_post.reposts.count()
        return self.reposts.count()

    @property
    def is_reply(self):
        return self.post_type == 'reply'

    @property
    def is_repost(self):
        return self.post_type == 'repost'

    @property
    def is_quote(self):
        return self.post_type == 'quote'

    @property
    def is_scheduled(self):
        """Returns True if post is scheduled for future publication"""
        return self.scheduled_time and self.scheduled_time > timezone.now()

    @property 
    def is_published(self):
        """Returns True if post is published (not scheduled)"""
        return not self.is_scheduled

    def get_absolute_url(self):
        return f'/{self.author.handle}/post/{self.id}/'

    def is_liked_by(self, user):
        return self.likes.filter(id=user.id).exists()

    def is_bookmarked_by(self, user):
        return self.bookmarks.filter(id=user.id).exists()

    def is_reposted_by(self, user):
        return self.reposts.filter(id=user.id).exists()

    def extract_and_save_hashtags(self):
        print("\n=== HASHTAG EXTRACTION DEBUG ===")
        print(f"Post ID: {self.id}")
        print(f"Content: {self.content}")
        
        # Extract hashtags using regex
        hashtag_pattern = r'#(\w+)'
        found_tags = set(tag.lower() for tag in re.findall(hashtag_pattern, self.content))
        print(f"Found hashtags: {found_tags}")
        
        # Get or create hashtags
        current_hashtags = set()
        for tag_name in found_tags:
            hashtag, created = Hashtag.objects.get_or_create(name=tag_name)
            print(f"Hashtag '{tag_name}': {'Created' if created else 'Already exists'}")
            current_hashtags.add(hashtag)
        
        # Update post's hashtags
        existing_hashtags = set(self.hashtags.all())
        print(f"Existing hashtags: {[tag.name for tag in existing_hashtags]}")
        
        # Remove hashtags that are no longer in the content
        to_remove = existing_hashtags - current_hashtags
        if to_remove:
            print(f"Removing hashtags: {[tag.name for tag in to_remove]}")
            self.hashtags.remove(*to_remove)
        
        # Add new hashtags
        to_add = current_hashtags - existing_hashtags
        if to_add:
            print(f"Adding hashtags: {[tag.name for tag in to_add]}")
            self.hashtags.add(*to_add)
        
        print("=== HASHTAG EXTRACTION END ===\n")

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # Extract and save hashtags after saving the post
        if self.content:  # Only process if there's content
            self.extract_and_save_hashtags()
