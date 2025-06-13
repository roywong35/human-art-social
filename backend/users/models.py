from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import RegexValidator
from django.db.models.signals import pre_save
from django.dispatch import receiver

class User(AbstractUser):
    """
    Custom user model for the AI-free artwork social platform.
    Extends Django's AbstractUser to add custom fields.
    """
    # Remove first_name and last_name from AbstractUser
    first_name = None
    last_name = None
    
    email = models.EmailField(
        unique=True,
        error_messages={
            'unique': 'A user with that email already exists.',
        }
    )
    
    handle = models.CharField(
        max_length=30,
        unique=True,
        null=True,
        blank=True,
        validators=[
            RegexValidator(
                regex=r'^[a-zA-Z0-9_]+$',
                message='Handle can only contain letters, numbers, and underscores'
            )
        ],
        help_text='Unique identifier for mentions (e.g. @handle)'
    )
    bio = models.TextField(max_length=500, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    banner_image = models.ImageField(upload_to='banner_images/', null=True, blank=True)
    location = models.CharField(max_length=100, blank=True)
    website = models.URLField(max_length=200, blank=True)
    is_artist = models.BooleanField(default=False)
    verified_artist = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    followers = models.ManyToManyField('self', symmetrical=False, related_name='following', blank=True)
    following_only_preference = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'
        
    def __str__(self):
        return self.username
        
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def followers_count(self):
        return self.followers.count()

    @property
    def following_count(self):
        return self.following.count()

    @property
    def is_following(self):
        if not hasattr(self, '_is_following'):
            return False
        return self._is_following

@receiver(pre_save, sender=User)
def set_default_handle(sender, instance, **kwargs):
    """
    Set default handle based on username if not provided
    """
    if not instance.handle:
        instance.handle = instance.username
