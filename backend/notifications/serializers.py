from rest_framework import serializers
from .models import Notification
from users.serializers import UserSerializer
from posts.serializers import PostSerializer

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    post = PostSerializer(read_only=True)
    comment = PostSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'sender', 'notification_type', 'post', 'comment', 'is_read', 'created_at']
        read_only_fields = ['sender', 'notification_type', 'post', 'comment', 'created_at'] 