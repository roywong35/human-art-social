from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Post, EvidenceFile, PostImage, Hashtag

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'handle', 'profile_picture']

class EvidenceFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenceFile
        fields = ['id', 'file', 'file_type', 'created_at']
        read_only_fields = ['created_at']

class PostImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = PostImage
        fields = ['id', 'image', 'image_url', 'order', 'created_at']
        read_only_fields = ['created_at']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    reposts_count = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    referenced_post = serializers.SerializerMethodField()
    evidence_files = EvidenceFileSerializer(many=True, read_only=True)
    images = PostImageSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'content', 'author', 'created_at', 'updated_at', 
                 'likes_count', 'reposts_count', 'replies_count',
                 'is_liked', 'is_reposted', 'is_bookmarked',
                 'post_type', 'referenced_post', 'evidence_files', 'images',
                 'conversation_chain', 'is_human_drawing', 'is_verified',
                 'image']

    def get_likes_count(self, obj):
        # For reposts, use the original post's likes count
        if obj.post_type == 'repost' and obj.referenced_post:
            return obj.referenced_post.likes.count()
        return obj.likes.count()

    def get_reposts_count(self, obj):
        # For reposts, use the original post's reposts count
        if obj.post_type == 'repost' and obj.referenced_post:
            return obj.referenced_post.reposts.count()
        return obj.reposts.count()

    def get_replies_count(self, obj):
        # For reposts, use the original post's replies count
        if obj.post_type == 'repost' and obj.referenced_post:
            return obj.referenced_post.replies.count()
        return obj.replies.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # For reposts, check if the original post is liked
        if obj.post_type == 'repost' and obj.referenced_post:
            return obj.referenced_post.likes.filter(id=request.user.id).exists()
        return obj.likes.filter(id=request.user.id).exists()

    def get_is_reposted(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
            
        # For reposts, check if user has reposted the referenced post
        if obj.post_type == 'repost' and obj.referenced_post:
            return obj.referenced_post.reposters.filter(id=request.user.id).exists()
            
        # For original posts, check if user has reposted this post
        return obj.reposters.filter(id=request.user.id).exists()

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # For reposts, check if the original post is bookmarked
        if obj.post_type == 'repost' and obj.referenced_post:
            return obj.referenced_post.bookmarks.filter(id=request.user.id).exists()
        return obj.bookmarks.filter(id=request.user.id).exists()

    def get_referenced_post(self, obj):
        if (obj.post_type == 'repost' or obj.post_type == 'quote') and obj.referenced_post:
            # Return the original post data
            return PostSerializer(obj.referenced_post, context=self.context).data
        return None

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)

class HashtagSerializer(serializers.ModelSerializer):
    post_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Hashtag
        fields = ['name', 'post_count']
    
    def get_post_count(self, obj):
        # Only count original posts and quotes, not reposts
        return obj.posts.exclude(post_type='repost').count() 