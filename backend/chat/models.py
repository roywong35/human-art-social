from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
import os
import uuid

User = get_user_model()

def message_image_path(instance, filename):
    # Get the file extension
    ext = filename.split('.')[-1]
    # Generate a unique filename using UUID
    filename = f"{uuid.uuid4()}.{ext}"
    # Return the upload path
    return os.path.join('chat_images', filename)

class ConversationManager(models.Manager):
    """Custom manager that excludes soft-deleted conversations by default"""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

class Conversation(models.Model):
    """
    Model for chat conversations between users.
    """
    participants = models.ManyToManyField(User, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    
    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    # Custom managers
    objects = ConversationManager()  # Excludes soft-deleted by default
    all_objects = models.Manager()  # Includes soft-deleted
    
    class Meta:
        ordering = ['-last_message_at', '-created_at']
    
    def __str__(self):
        participant_names = ', '.join([user.username for user in self.participants.all()[:2]])
        return f'Conversation: {participant_names}'
    
    def get_other_participant(self, current_user):
        """Get the other participant in a 1-on-1 conversation"""
        return self.participants.exclude(id=current_user.id).first()
    
    def get_last_message(self):
        """Get the last message in this conversation"""
        return self.messages.first()
    
    def get_unread_count(self, user):
        """Get unread message count for a specific user"""
        return self.messages.filter(is_read=False).exclude(sender=user).count()
    
    def soft_delete(self):
        """Soft delete this conversation by marking it as deleted"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
    
    def restore(self):
        """Restore a soft-deleted conversation"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()

class MessageManager(models.Manager):
    """Custom manager that excludes soft-deleted messages by default"""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

class Message(models.Model):
    """
    Model for chat messages within conversations.
    """
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(blank=True)
    image = models.ImageField(upload_to=message_image_path, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    
    # Soft delete fields
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    # Custom managers
    objects = MessageManager()  # Excludes soft-deleted by default
    all_objects = models.Manager()  # Includes soft-deleted
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f'{self.sender.username}: {self.content[:50]}'
    
    def save(self, *args, **kwargs):
        # Update conversation's last_message_at when saving a message
        super().save(*args, **kwargs)
        self.conversation.last_message_at = self.created_at
        self.conversation.save()
    
    def soft_delete(self):
        """Soft delete this message by marking it as deleted"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
    
    def restore(self):
        """Restore a soft-deleted message"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()
