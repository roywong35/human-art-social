from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification
from django.contrib.auth import get_user_model

User = get_user_model()

def create_notification(sender, recipient, notification_type, post=None, comment=None):
    """
    Create a notification and send it through WebSocket
    """
    # Don't create notification if sender is recipient
    if sender == recipient:
        return None

    notification = Notification.objects.create(
        sender=sender,
        recipient=recipient,
        notification_type=notification_type,
        post=post,
        comment=comment
    )

    # Prepare notification data for WebSocket
    notification_data = {
        'id': notification.id,
        'type': notification_type,
        'sender': {
            'id': sender.id,
            'username': sender.username,
            'avatar': sender.profile_picture.url if sender.profile_picture else None,
        },
        'post_id': post.id if post else None,
        'comment_id': comment.id if comment else None,
        'created_at': notification.created_at.isoformat(),
    }

    # Send notification through WebSocket
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"notifications_{recipient.id}",
        {
            'type': 'notification_message',
            'message': notification_data
        }
    )

    return notification

def create_like_notification(sender, post):
    if sender != post.author:
        create_notification(sender, post.author, 'like', post=post)

def create_comment_notification(sender, post, comment):
    if sender != post.author:
        create_notification(sender, post.author, 'comment', post=post, comment=comment)

def create_follow_notification(sender, recipient):
    if sender != recipient:
        create_notification(sender, recipient, 'follow')

def create_repost_notification(sender, post):
    if sender != post.author:
        create_notification(sender, post.author, 'repost', post=post) 