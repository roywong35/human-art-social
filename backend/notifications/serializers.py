from rest_framework import serializers
from .models import Notification
from users.serializers import UserSerializer
from posts.serializers import UserPostSerializer, PostRemovalSerializer

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    # Use PostRemovalSerializer for post_removed notifications, UserPostSerializer for others
    post = serializers.SerializerMethodField()
    comment = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'sender', 'notification_type', 'post', 'comment', 'is_read', 'created_at']
        read_only_fields = ['sender', 'notification_type', 'post', 'created_at']

    def get_post(self, obj):
        """Use appropriate serializer based on notification type"""
        if obj.post:
            if obj.notification_type == 'post_removed':
                # Use PostRemovalSerializer to show full content for removed posts
                return PostRemovalSerializer(obj.post, context=self.context).data
            else:
                # Use secure UserPostSerializer for other notifications
                return UserPostSerializer(obj.post, context=self.context).data
        return None

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
            if hasattr(obj.comment, 'id') and hasattr(obj.comment, 'content'):
                return {
                    'id': obj.comment.id,
                    'content': obj.comment.content
                }
        else:
            return None

class GroupedNotificationSerializer(serializers.Serializer):
    """Serializer for grouped notifications"""
    notification_type = serializers.CharField()
    post = serializers.SerializerMethodField(required=False, allow_null=True)
    comment = serializers.SerializerMethodField(required=False)
    users = serializers.ListField(child=UserSerializer())
    latest_time = serializers.DateTimeField()
    is_read = serializers.BooleanField()
    notification_ids = serializers.ListField(child=serializers.IntegerField())
    
    def get_post(self, obj):
        """Use appropriate serializer based on notification type"""
        if obj.get('post'):
            if obj.get('notification_type') == 'post_removed':
                # Use PostRemovalSerializer to show full content for removed posts
                from posts.serializers import PostRemovalSerializer
                return PostRemovalSerializer(obj['post'], context=self.context).data
            else:
                # Use secure UserPostSerializer for other notifications
                return UserPostSerializer(obj['post'], context=self.context).data
        return None
    
    def get_comment(self, obj):
        """Handle both comments and donations"""
        if obj.get('notification_type') == 'donation':
            # For donations, use content_object from the first notification
            first_notification = obj.get('notifications', [{}])[0]
            if first_notification and hasattr(first_notification, 'content_object') and hasattr(first_notification.content_object, 'amount'):
                return {
                    'id': first_notification.content_object.id,
                    'content': getattr(first_notification.content_object, 'message', ''),
                    'amount': float(first_notification.content_object.amount)
                }
            else:
                return None
        elif obj.get('comment'):
            # For regular comments, return comment data
            comment = obj['comment']
            if hasattr(comment, 'id') and hasattr(comment, 'content'):
                return {
                    'id': comment.id,
                    'content': comment.content
                }
        return None 