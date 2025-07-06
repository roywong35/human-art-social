from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Conversation, Message

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'handle', 'profile_picture']
    
    def get_profile_picture(self, obj):
        request = self.context.get('request')
        if obj.profile_picture and hasattr(obj.profile_picture, 'url'):
            return request.build_absolute_uri(obj.profile_picture.url) if request else obj.profile_picture.url
        return None

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = ['id', 'content', 'image', 'image_url', 'sender', 'created_at', 'is_read']
        read_only_fields = ['created_at', 'sender']
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

class ConversationSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = ['id', 'participants', 'other_participant', 'last_message', 'unread_count', 'created_at', 'updated_at', 'last_message_at']
        read_only_fields = ['created_at', 'updated_at', 'last_message_at']
    
    def get_other_participant(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        other_user = obj.get_other_participant(request.user)
        if other_user:
            return UserSerializer(other_user, context=self.context).data
        return None
    
    def get_last_message(self, obj):
        last_message = obj.get_last_message()
        if last_message:
            return MessageSerializer(last_message, context=self.context).data
        return None
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.get_unread_count(request.user)

class ConversationDetailSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    other_participant = serializers.SerializerMethodField()
    messages = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = ['id', 'participants', 'other_participant', 'messages', 'created_at', 'updated_at', 'last_message_at']
        read_only_fields = ['created_at', 'updated_at', 'last_message_at']
    
    def get_other_participant(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        other_user = obj.get_other_participant(request.user)
        if other_user:
            return UserSerializer(other_user, context=self.context).data
        return None
    
    def get_messages(self, obj):
        # Get recent messages (last 50) in reverse order for chat display
        messages = obj.messages.all()[:50]
        return MessageSerializer(messages, many=True, context=self.context).data 