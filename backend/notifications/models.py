from django.db import models
from django.conf import settings

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('like', 'Like'),
        ('comment', 'Comment'),
        ('follow', 'Follow'),
        ('repost', 'Repost'),
        ('report_received', 'Report Received'),
        ('post_removed', 'Post Removed for Multiple Reports'),
        ('appeal_approved', 'Appeal Approved'),
        ('appeal_rejected', 'Appeal Rejected'),
        ('art_verified', 'Art Verified'),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications_received'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications_sent',
        null=True,
        blank=True
    )
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    post = models.ForeignKey(
        'posts.Post',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    comment = models.ForeignKey(
        'posts.Post',  # Since comments are also posts in your system
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='comment_notifications'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['is_read', '-created_at']),
        ]

    def __str__(self):
        sender_name = self.sender.username if self.sender else "System"
        return f"{sender_name} {self.notification_type} - {self.created_at}"
