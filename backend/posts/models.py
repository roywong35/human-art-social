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

class PostManager(models.Manager):
    """Custom manager that excludes soft-deleted posts by default"""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

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
    
    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    # Custom managers
    objects = PostManager()  # Excludes soft-deleted by default
    all_objects = models.Manager()  # Includes soft-deleted
    
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
    
    def soft_delete(self):
        """Soft delete this post by marking it as deleted"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
    
    def restore(self):
        """Restore a soft-deleted post"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()

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


class ContentReport(models.Model):
    """
    Model for content reports against posts.
    Supports different report types with dynamic categories based on post type.
    """
    REPORT_TYPES = (
        ('ai_art', 'AI Art'),
        ('harassment', 'Harassment/Abuse'),
        ('spam', 'Spam'),
        ('inappropriate', 'Inappropriate Content'),
        ('misinformation', 'Misinformation'),
        ('copyright', 'Copyright Violation'),
        ('other', 'Other'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    )
    
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_reports')
    reported_post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reports')
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    description = models.TextField(blank=True, help_text='Optional additional details about the report')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_reports')
    
    class Meta:
        unique_together = ['reporter', 'reported_post', 'report_type']  # Prevent duplicate reports
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['reported_post', 'status']),
            models.Index(fields=['reporter', 'created_at']),
            models.Index(fields=['status', 'created_at']),
        ]
    
    def __str__(self):
        return f'{self.reporter.username} reported {self.reported_post.author.username}\'s post for {self.get_report_type_display()}'
    
    @property
    def is_resolved(self):
        return self.status in ['resolved', 'dismissed']
    
    @classmethod
    def get_report_types_for_post(cls, post):
        """
        Get available report types for a specific post.
        AI Art reports are only available for human art posts.
        """
        base_types = [
            ('harassment', 'Harassment/Abuse'),
            ('spam', 'Spam'),
            ('inappropriate', 'Inappropriate Content'),
            ('misinformation', 'Misinformation'),
            ('copyright', 'Copyright Violation'),
            ('other', 'Other'),
        ]
        
        # Add AI Art option only for human art posts
        if post.is_human_drawing:
            return [('ai_art', 'AI Art')] + base_types
        
        return base_types
    
    @classmethod
    def get_report_count_for_post(cls, post, report_type=None):
        """
        Get the count of reports for a specific post, optionally filtered by report type.
        """
        queryset = cls.objects.filter(reported_post=post, status='pending')
        if report_type:
            queryset = queryset.filter(report_type=report_type)
        return queryset.count()
    
    @classmethod
    def is_post_reported_by_user(cls, post, user):
        """
        Check if a post has been reported by a specific user.
        """
        return cls.objects.filter(
            reported_post=post,
            reporter=user,
            status='pending'
        ).exists()
    
    @classmethod
    def get_posts_to_hide_from_user(cls, user):
        """
        Get posts that should be hidden from a specific user (posts they've reported).
        """
        return cls.objects.filter(
            reporter=user,
            status='pending'
        ).values_list('reported_post_id', flat=True)
    
    @classmethod
    def get_posts_to_hide_from_timeline(cls):
        """
        Get posts that should be hidden from the main timeline (3+ reports).
        """
        from django.db.models import Count
        
        return cls.objects.filter(
            status='pending'
        ).values('reported_post_id').annotate(
            report_count=Count('id')
        ).filter(report_count__gte=3).values_list('reported_post_id', flat=True)
    
    @classmethod
    def get_posts_to_hide_from_human_art(cls):
        """
        Get posts that should be hidden from human art timeline due to AI art reports.
        """
        from django.db.models import Count
        
        return cls.objects.filter(
            status='pending',
            report_type='ai_art'
        ).values('reported_post_id').annotate(
            report_count=Count('id')
        ).filter(report_count__gte=3).values_list('reported_post_id', flat=True)


def appeal_evidence_path(instance, filename):
    """
    Generate upload path for appeal evidence files
    """
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('appeal_evidence', filename)


class PostAppeal(models.Model):
    """
    Model for appeals when posts are auto-removed due to multiple reports.
    """
    STATUS_CHOICES = (
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    
    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name='appeal')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='appeals')
    appeal_text = models.TextField(help_text='User explanation for why the post should be restored')
    evidence_files = models.JSONField(default=list, blank=True, help_text='List of evidence file paths')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_appeals')
    admin_notes = models.TextField(blank=True, help_text='Admin notes about the appeal decision')
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['author', '-created_at']),
        ]
    
    def __str__(self):
        return f'Appeal by {self.author.username} for post {self.post.id} - {self.status}'
    
    @property
    def is_pending(self):
        return self.status == 'pending'
    
    @property
    def is_approved(self):
        return self.status == 'approved'
    
    @property
    def is_rejected(self):
        return self.status == 'rejected'
    
    def save(self, *args, **kwargs):
        # Set reviewed_at when status changes from pending
        if self.pk:
            old_instance = PostAppeal.objects.get(pk=self.pk)
            if old_instance.status == 'pending' and self.status != 'pending':
                self.reviewed_at = timezone.now()
        super().save(*args, **kwargs)


class AppealEvidenceFile(models.Model):
    """
    Model for storing evidence files submitted with appeals
    """
    appeal = models.ForeignKey(PostAppeal, on_delete=models.CASCADE, related_name='evidence_files_rel')
    file = models.FileField(upload_to=appeal_evidence_path)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)  # image, document, etc.
    file_size = models.PositiveIntegerField()  # in bytes
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Evidence for appeal {self.appeal.id}: {self.original_filename}"
    
    class Meta:
        ordering = ['created_at']


def draft_image_path(instance, filename):
    """
    Generate upload path for draft images
    """
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('draft_images', filename)


def scheduled_post_image_path(instance, filename):
    """
    Generate upload path for scheduled post images
    """
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('scheduled_post_images', filename)


class Draft(models.Model):
    """
    Model for saving draft posts that users are working on.
    These are incomplete posts that haven't been published yet.
    """
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='drafts')
    content = models.TextField(blank=True)
    scheduled_time = models.DateTimeField(null=True, blank=True, help_text="Optional scheduled time for when this draft should be published")
    quote_post = models.ForeignKey(Post, on_delete=models.SET_NULL, null=True, blank=True, related_name='quoted_in_drafts', help_text="Post being quoted in this draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Post type and related fields for draft context
    post_type = models.CharField(max_length=15, choices=Post.POST_TYPES, default='post')
    parent_post = models.ForeignKey(Post, on_delete=models.SET_NULL, null=True, blank=True, related_name='reply_drafts', help_text="Parent post if this is a reply draft")
    
    # Human drawing fields for art posts
    is_human_drawing = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['author', '-updated_at']),
        ]
    
    def __str__(self):
        return f"Draft by {self.author.username}: {self.content[:50]}"


class DraftImage(models.Model):
    """
    Model for storing multiple images per draft
    """
    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to=draft_image_path)
    order = models.IntegerField(default=0)  # To maintain image order
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Image {self.order} for draft {self.draft.id}"


class ScheduledPost(models.Model):
    """
    Model for posts that are scheduled to be published in the future.
    These are complete posts waiting to be published.
    """
    STATUS_CHOICES = (
        ('scheduled', 'Scheduled'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    )
    
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scheduled_posts')
    content = models.TextField(blank=True)
    scheduled_time = models.DateTimeField(help_text="When this post should be published")
    quote_post = models.ForeignKey(Post, on_delete=models.SET_NULL, null=True, blank=True, related_name='quoted_in_scheduled', help_text="Post being quoted")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='scheduled')
    
    # Post type and related fields
    post_type = models.CharField(max_length=15, choices=Post.POST_TYPES, default='post')
    parent_post = models.ForeignKey(Post, on_delete=models.SET_NULL, null=True, blank=True, related_name='scheduled_replies', help_text="Parent post if this is a reply")
    
    # Human drawing fields for art posts
    is_human_drawing = models.BooleanField(default=False)
    
    # Track the actual post created when this scheduled post is published
    published_post = models.ForeignKey(Post, on_delete=models.SET_NULL, null=True, blank=True, related_name='scheduled_source', help_text="The actual post created when this was published")
    
    class Meta:
        ordering = ['scheduled_time']
        indexes = [
            models.Index(fields=['author', 'status', 'scheduled_time']),
            models.Index(fields=['status', 'scheduled_time']),
        ]
    
    def __str__(self):
        return f"Scheduled post by {self.author.username} for {self.scheduled_time}: {self.content[:50]}"
    
    @property
    def is_due(self):
        """Returns True if the scheduled time has passed and post should be published"""
        return self.scheduled_time <= timezone.now()


class ScheduledPostImage(models.Model):
    """
    Model for storing multiple images per scheduled post
    """
    scheduled_post = models.ForeignKey(ScheduledPost, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to=scheduled_post_image_path)
    order = models.IntegerField(default=0)  # To maintain image order
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Image {self.order} for scheduled post {self.scheduled_post.id}"
