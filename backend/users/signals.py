from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings
from .models import User

@receiver(post_save, sender=User)
def send_welcome_email(sender, instance, created, **kwargs):
    """
    Send a welcome email when a new user is created.
    Note: Email sending is commented out as it needs proper email settings configuration
    """
    if created:
        pass
        # Uncomment and configure email settings in settings.py to enable welcome emails
        # send_mail(
        #     'Welcome to AI-Free Artwork Platform',
        #     f'Welcome {instance.get_full_name()}! Thank you for joining our platform.',
        #     settings.DEFAULT_FROM_EMAIL,
        #     [instance.email],
        #     fail_silently=True,
        # )

@receiver(post_save, sender=User)
def handle_artist_verification(sender, instance, **kwargs):
    """
    Handle actions when an artist is verified
    """
    if instance.verified_artist and not instance.is_artist:
        instance.is_artist = True
        instance.save(update_fields=['is_artist']) 