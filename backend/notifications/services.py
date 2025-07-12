from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification
from django.contrib.auth import get_user_model

User = get_user_model()

def create_notification(sender, recipient, notification_type, post=None, comment=None):
    """
    Create a notification and send it through WebSocket
    """
    sender_name = sender.username if sender else "System"
    print(f"🔔 [CREATE_NOTIFICATION] Creating notification: {sender_name} -> {recipient.username} ({notification_type})")
    print(f"🔔 [CREATE_NOTIFICATION] Recipient ID: {recipient.id}")
    
    # Don't create notification if sender is recipient (skip for system notifications)
    if sender and sender == recipient:
        print(f"🔔 [CREATE_NOTIFICATION] Skipping notification - sender is recipient")
        return None

    try:
        notification = Notification.objects.create(
            sender=sender,
            recipient=recipient,
            notification_type=notification_type,
            post=post,
            comment=comment
        )
        print(f"🔔 [CREATE_NOTIFICATION] Notification created with ID: {notification.id}")
        print(f"🔔 [CREATE_NOTIFICATION] Notification saved to database successfully")
    except Exception as e:
        print(f"❌ [CREATE_NOTIFICATION] Error creating notification in database: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

    # Prepare notification data for WebSocket
    notification_data = {
        'type': 'notification',  # This is what the frontend expects
        'id': notification.id,
        'notification_type': notification_type,  # The specific type like 'like', 'comment', etc.
        'sender': {
            'id': sender.id if sender else None,
            'username': sender.username if sender else 'System',
            'avatar': sender.profile_picture.url if sender and sender.profile_picture else None,
        } if sender else {
            'id': None,
            'username': 'System',
            'avatar': None,
        },
        'post_id': post.id if post else None,
        'comment_id': comment.id if comment else None,
        'created_at': notification.created_at.isoformat(),
    }

    # Send notification through WebSocket
    print(f"🔔 [CREATE_NOTIFICATION] Sending WebSocket notification to notifications_{recipient.id}")
    print(f"🔔 [CREATE_NOTIFICATION] Notification data: {notification_data}")
    
    try:
        channel_layer = get_channel_layer()
        print(f"🔔 [CREATE_NOTIFICATION] Got channel layer: {channel_layer}")
        
        async_to_sync(channel_layer.group_send)(
            f"notifications_{recipient.id}",
            {
                'type': 'notification_message',
                'message': notification_data
            }
        )
        print(f"🔔 [CREATE_NOTIFICATION] WebSocket notification sent successfully")
    except Exception as e:
        print(f"❌ [CREATE_NOTIFICATION] Error sending WebSocket notification: {str(e)}")
        import traceback
        traceback.print_exc()
        # Don't raise here - notification was saved to DB, just WebSocket failed

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

def create_report_received_notification(reporter, post):
    """
    Create a notification to the reporter when their report is received
    """
    print(f"🔔 [NOTIFICATION SERVICE] create_report_received_notification called: Report received from {reporter.username}")
    print(f"🔔 [NOTIFICATION SERVICE] Reporter ID: {reporter.id}, Post ID: {post.id}")
    
    try:
        result = create_notification(sender=None, recipient=reporter, notification_type='report_received', post=post)
        print(f"🔔 [NOTIFICATION SERVICE] create_notification returned: {result}")
        return result
    except Exception as e:
        print(f"❌ [NOTIFICATION SERVICE] Error in create_report_received_notification: {str(e)}")
        import traceback
        traceback.print_exc()
        raise 