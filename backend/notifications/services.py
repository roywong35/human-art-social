from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification
from django.contrib.auth import get_user_model

User = get_user_model()

def create_notification(sender, recipient, notification_type, post=None, comment=None):
    """
    Create a notification and send it through WebSocket
    """
    print(f"🔔 Creating notification: {sender.username} -> {recipient.username} ({notification_type})")
    
    # Don't create notification if sender is recipient
    if sender == recipient:
        print(f"🔔 Skipping notification - sender is recipient")
        return None

    notification = Notification.objects.create(
        sender=sender,
        recipient=recipient,
        notification_type=notification_type,
        post=post,
        comment=comment
    )
    print(f"🔔 Notification created with ID: {notification.id}")

    # Prepare notification data for WebSocket
    notification_data = {
        'type': 'notification',  # This is what the frontend expects
        'id': notification.id,
        'notification_type': notification_type,  # The specific type like 'like', 'comment', etc.
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
    print(f"🔔 Sending WebSocket notification to notifications_{recipient.id}")
    print(f"🔔 Notification data: {notification_data}")
    
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"notifications_{recipient.id}",
        {
            'type': 'notification_message',
            'message': notification_data
        }
    )
    print(f"🔔 WebSocket notification sent successfully")

    return notification

def create_like_notification(sender, post):
    print(f"🔔 create_like_notification called: {sender.username} liked {post.author.username}'s post")
    if sender != post.author:
        create_notification(sender, post.author, 'like', post=post)
    else:
        print(f"🔔 Skipping like notification - user liked their own post")

def create_comment_notification(sender, post, comment):
    print(f"🔔 create_comment_notification called: {sender.username} commented on {post.author.username}'s post")
    if sender != post.author:
        create_notification(sender, post.author, 'comment', post=post, comment=comment)
    else:
        print(f"🔔 Skipping comment notification - user commented on their own post")

def create_follow_notification(sender, recipient):
    print(f"🔔 create_follow_notification called: {sender.username} followed {recipient.username}")
    if sender != recipient:
        create_notification(sender, recipient, 'follow')
    else:
        print(f"🔔 Skipping follow notification - user tried to follow themselves")

def create_repost_notification(sender, post):
    print(f"🔔 create_repost_notification called: {sender.username} reposted {post.author.username}'s post")
    if sender != post.author:
        create_notification(sender, post.author, 'repost', post=post)
    else:
        print(f"🔔 Skipping repost notification - user reposted their own post") 