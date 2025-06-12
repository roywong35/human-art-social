from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Post, EvidenceFile, PostImage

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'handle', 'display_name', 'profile_picture']

class EvidenceFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenceFile
        fields = ['id', 'file', 'file_type', 'created_at']
        read_only_fields = ['created_at']

class PostImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostImage
        fields = ['id', 'image', 'order', 'created_at']
        read_only_fields = ['created_at']

class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    reposts_count = serializers.IntegerField(read_only=True)
    replies_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()
    referenced_post = serializers.SerializerMethodField()
    parent_post = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    evidence_files = EvidenceFileSerializer(many=True, read_only=True)
    images = PostImageSerializer(many=True, read_only=True)
    
    class Meta:
        model = Post
        fields = [
            'id', 'content', 'image', 'images', 'author', 
            'created_at', 'updated_at', 'post_type',
            'likes_count', 'reposts_count', 'replies_count',
            'replies', 'is_liked', 'is_bookmarked', 'is_reposted',
            'referenced_post', 'parent_post',
            'is_human_drawing', 'is_verified', 'verification_date',
            'evidence_files', 'media'
        ]
        read_only_fields = [
            'author', 'created_at', 'updated_at', 
            'likes_count', 'reposts_count', 'replies_count',
            'is_verified', 'verification_date'
        ]

    def get_replies(self, obj):
        # Check if we're already serializing replies to prevent recursion
        if self.context.get('is_reply'):
            return []
        # For normal views, show all direct replies
        replies = obj.replies.all().order_by('-created_at')
        # Set context to indicate we're serializing replies
        context = {**self.context, 'is_reply': True}
        return PostSerializer(replies, many=True, context=context).data

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.bookmarks.filter(id=request.user.id).exists()
        return False

    def get_is_reposted(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.reposts.filter(id=request.user.id).exists()
        return False

    def get_referenced_post(self, obj):
        if obj.referenced_post:
            return PostSerializer(obj.referenced_post, context=self.context).data
        return None

    def get_parent_post(self, obj):
        if obj.parent_post:
            return PostSerializer(obj.parent_post, context=self.context).data
        return None

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data) 