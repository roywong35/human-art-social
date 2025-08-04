from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification
from django.contrib.auth import get_user_model

User = get_user_model()

def create_notification(sender, recipient, notification_type, post=None, comment=None):
    """
    Create a notification and send it through WebSocket
    """
    # Don't create notification if sender is recipient (skip for system notifications)
    if sender and sender == recipient:
        return None

    try:
        notification = Notification.objects.create(
            sender=sender,
            recipient=recipient,
            notification_type=notification_type,
            post=post,
            comment=comment
        )
        print(f"🔔 Notification created: {notification.id}")
    except Exception as e:
        print(f"❌ Error creating notification in database: {str(e)}")
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
        } if sender else None,  # Set to None for system notifications
        'post_id': post.id if post else None,
        'comment_id': comment.id if comment else None,
        'created_at': notification.created_at.isoformat(),
    }
    
    # Add comment data if comment exists (for comments and donations)
    if comment:
        if notification_type == 'donation':
            # For donations, include the donation amount
            notification_data['comment'] = {
                'id': comment.id,
                'content': comment.message if hasattr(comment, 'message') else '',
                'amount': float(comment.amount) if hasattr(comment, 'amount') else 0
            }
        else:
            # For regular comments
            notification_data['comment'] = {
                'id': comment.id,
                'content': comment.content
            }
    
    # Add full post data if post exists
    if post:
        notification_data['post'] = {
            'id': post.id,
            'content': post.content,
            'author': {
                'id': post.author.id,
                'username': post.author.username,
                'handle': post.author.handle,
                'profile_picture': post.author.profile_picture.url if post.author.profile_picture else None,
            },
            'post_type': post.post_type,
            'created_at': post.created_at.isoformat(),
            'image': post.image.url if post.image else None,
            'images': [
                {
                    'id': img.id,
                    'image': img.image.url,
                    'filename': img.image.name.split('/')[-1]
                } for img in post.images.all()
            ],
            'is_human_drawing': post.is_human_drawing,
        }
    
    # Send notification through WebSocket
    try:
        channel_layer = get_channel_layer()
        
        group_name = f"notifications_{recipient.id}"
        websocket_data = {
            'type': 'notification_message',
            'message': notification_data
        }
        
        async_to_sync(channel_layer.group_send)(group_name, websocket_data)
        
    except Exception as e:
        print(f"❌ Error sending WebSocket notification: {str(e)}")
        import traceback
        traceback.print_exc()
        # Don't raise here - notification was saved to DB, just WebSocket failed

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

def create_donation_notification(sender, post, donation):
    """
    Create a notification to the post author when someone donates to their verified human art post
    """
    try:
        # Create notification with donation as content_object
        notification = Notification.objects.create(
            sender=sender,
            recipient=post.author,
            notification_type='donation',
            post=post,
            content_object=donation  # Use content_object for donation
        )
        print(f"🔔 Donation notification created: {notification.id}")
        
        # Prepare notification data for WebSocket
        notification_data = {
            'type': 'notification',
            'id': notification.id,
            'notification_type': 'donation',
            'sender': {
                'id': sender.id,
                'username': sender.username,
                'avatar': sender.profile_picture.url if sender.profile_picture else None,
            },
            'post_id': post.id,
            'created_at': notification.created_at.isoformat(),
            'comment': {
                'id': donation.id,
                'content': donation.message if donation.message else '',
                'amount': float(donation.amount)
            }
        }
        
        # Add full post data
        notification_data['post'] = {
            'id': post.id,
            'content': post.content,
            'author': {
                'id': post.author.id,
                'username': post.author.username,
                'handle': post.author.handle,
                'profile_picture': post.author.profile_picture.url if post.author.profile_picture else None,
            },
            'post_type': post.post_type,
            'created_at': post.created_at.isoformat(),
            'image': post.image.url if post.image else None,
            'images': [
                {
                    'id': img.id,
                    'image': img.image.url,
                    'filename': img.image.name.split('/')[-1]
                } for img in post.images.all()
            ],
            'is_human_drawing': post.is_human_drawing,
        }
        
        # Send notification through WebSocket
        try:
            channel_layer = get_channel_layer()
            group_name = f"notifications_{post.author.id}"
            websocket_data = {
                'type': 'notification_message',
                'message': notification_data
            }
            async_to_sync(channel_layer.group_send)(group_name, websocket_data)
        except Exception as e:
            print(f"❌ Error sending WebSocket notification: {str(e)}")
            import traceback
            traceback.print_exc()
        
        return notification
    except Exception as e:
        print(f"❌ Error in create_donation_notification: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

def create_report_received_notification(reporter, post):
    """
    Create a notification to the reporter when their report is received
    """
    try:
        result = create_notification(sender=None, recipient=reporter, notification_type='report_received', post=post)
        return result
    except Exception as e:
        print(f"❌ Error in create_report_received_notification: {str(e)}")
        import traceback
        traceback.print_exc()
        raise 

def create_post_removed_notification(post):
    """
    Create a notification to the post author when their post is removed due to multiple reports
    """
    try:
        result = create_notification(sender=None, recipient=post.author, notification_type='post_removed', post=post)
        return result
    except Exception as e:
        print(f"❌ Error in create_post_removed_notification: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

def create_appeal_approved_notification(appeal):
    """
    Create a notification to the post author when their appeal is approved and post is restored
    """
    try:
        result = create_notification(sender=None, recipient=appeal.author, notification_type='appeal_approved', post=appeal.post)
        return result
    except Exception as e:
        print(f"❌ Error in create_appeal_approved_notification: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

def create_appeal_rejected_notification(appeal):
    """
    Create a notification to the post author when their appeal is rejected
    """
    try:
        result = create_notification(sender=None, recipient=appeal.author, notification_type='appeal_rejected', post=appeal.post)
        return result
    except Exception as e:
        print(f"❌ Error in create_appeal_rejected_notification: {str(e)}")
        import traceback
        traceback.print_exc()
        raise 

def create_art_verified_notification(post):
    """
    Create a notification to the post author when their human art is verified by admin
    """
    try:
        result = create_notification(sender=None, recipient=post.author, notification_type='art_verified', post=post)
        return result
    except Exception as e:
        print(f"❌ Error in create_art_verified_notification: {str(e)}")
        import traceback
        traceback.print_exc()
        raise 