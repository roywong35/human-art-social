from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.validators import UniqueValidator

User = get_user_model()

class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    """
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    handle = serializers.CharField(required=True, validators=[UniqueValidator(queryset=User.objects.all())])

    class Meta:
        model = User
        fields = ('username', 'password', 'password2', 'email', 'handle')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user

class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile.
    """
    class Meta:
        model = User
        fields = ('username', 'handle', 'bio', 'profile_picture', 'banner_image', 'website', 'following_only_preference')
        read_only_fields = ('handle',)  # Handle cannot be changed after registration

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing user profiles with all necessary fields.
    """
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 
            'username', 
            'email', 
            'bio', 
            'profile_picture',
            'banner_image', 
            'website', 
            'is_artist', 
            'verified_artist', 
            'date_joined',
            'is_following',
            'followers_count',
            'following_count',
            'handle',
            'following_only_preference'
        )
        read_only_fields = ('id', 'date_joined', 'followers_count', 'following_count', 'is_following')

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user in obj.followers.all()
        return False

class UserSerializer(serializers.ModelSerializer):
    followers_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    posts_count = serializers.IntegerField(read_only=True)
    is_following = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'handle', 'display_name', 'email',
            'profile_picture', 'bio', 'location', 'website',
            'created_at', 'followers_count', 'following_count',
            'posts_count', 'is_following', 'is_verified',
            'is_private', 'profile_banner', 'url'
        ]
        read_only_fields = [
            'id', 'created_at', 'followers_count', 'following_count',
            'posts_count', 'is_following', 'is_verified', 'url'
        ]

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user in obj.followers.all()
        return False

    def get_url(self, obj):
        return obj.get_absolute_url() 