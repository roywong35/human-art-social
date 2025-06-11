from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Post, Comment, EvidenceFile, PostImage

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

class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    replies_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'content', 'author', 'created_at', 'updated_at',
            'likes_count', 'replies_count', 'is_liked', 'is_bookmarked',
            'parent_comment', 'media'
        ]
        read_only_fields = ['author', 'created_at', 'updated_at']

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

class PostImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostImage
        fields = ['id', 'image', 'order', 'created_at']
        read_only_fields = ['created_at']

class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    reposts_count = serializers.IntegerField(read_only=True)
    comments_count = serializers.IntegerField(read_only=True)
    total_comments_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()
    referenced_post = serializers.SerializerMethodField()
    referenced_comment = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    evidence_files = EvidenceFileSerializer(many=True, read_only=True)
    images = PostImageSerializer(many=True, read_only=True)
    
    class Meta:
        model = Post
        fields = [
            'id', 'content', 'image', 'images', 'author', 
            'created_at', 'updated_at', 'post_type',
            'likes_count', 'reposts_count', 'comments_count',
            'total_comments_count', 'comments',
            'is_liked', 'is_bookmarked', 'is_reposted',
            'referenced_post', 'referenced_comment',
            'is_human_drawing', 'is_verified', 'verification_date',
            'evidence_files', 'media'
        ]
        read_only_fields = [
            'author', 'created_at', 'updated_at', 
            'likes_count', 'reposts_count', 'comments_count',
            'total_comments_count', 'is_verified', 'verification_date'
        ]

    def get_comments(self, obj):
        # For normal views, show all comments
        comments = obj.comments.filter(parent_comment__isnull=True)
        return CommentSerializer(comments, many=True, context=self.context).data

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

    def get_referenced_comment(self, obj):
        if obj.referenced_comment:
            return CommentSerializer(obj.referenced_comment, context=self.context).data
        return None

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data) 