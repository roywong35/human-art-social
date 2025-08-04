from rest_framework import serializers
from .models import Notification
from users.serializers import UserSerializer
from posts.serializers import UserPostSerializer

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    # Use secure UserPostSerializer instead of PostSerializer to exclude evidence_files
    post = UserPostSerializer(read_only=True)
    comment = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'sender', 'notification_type', 'post', 'comment', 'is_read', 'created_at']
        read_only_fields = ['sender', 'notification_type', 'post', 'created_at']

    def get_comment(self, obj):
        """Handle both comments and donations"""
        if obj.notification_type == 'donation':
            # For donations, use content_object
            if obj.content_object and hasattr(obj.content_object, 'amount'):
                return {
                    'id': obj.content_object.id,
                    'content': getattr(obj.content_object, 'message', ''),
                    'amount': float(obj.content_object.amount)
                }
            else:
                return None
        elif obj.comment:
            # For regular comments, return comment data
            return {
                'id': obj.comment.id,
                'content': obj.comment.content
            }
        else:
            return None 