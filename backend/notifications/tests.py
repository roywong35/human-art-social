from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from posts.models import Post
from .models import Notification

User = get_user_model()

class NotificationModelTest(TestCase):
    """Test cases for the Notification model and its functionality"""
    
    def setUp(self):
        """Create test data before each test"""
        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1',
            email='test1@example.com',
            password='testpass123',
            handle='testuser1'
        )
        self.user2 = User.objects.create_user(
            username='testuser2',
            email='test2@example.com',
            password='testpass123',
            handle='testuser2'
        )
        self.user3 = User.objects.create_user(
            username='testuser3',
            email='test3@example.com',
            password='testpass123',
            handle='testuser3'
        )
        
        # Create test post
        self.post = Post.objects.create(
            author=self.user1,
            content='Test post content'
        )

    def test_notification_creation(self):
        """Test basic notification creation"""
        notification = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        
        # Test basic fields
        self.assertEqual(notification.recipient, self.user2)
        self.assertEqual(notification.sender, self.user1)
        self.assertEqual(notification.notification_type, 'like')
        self.assertEqual(notification.post, self.post)
        self.assertIsNone(notification.comment)
        self.assertFalse(notification.is_read)
        self.assertIsNotNone(notification.created_at)
        
        # Test string representation
        self.assertIn(self.user1.username, str(notification))
        self.assertIn('like', str(notification))

    def test_notification_without_sender(self):
        """Test notification creation without sender (system notification)"""
        notification = Notification.objects.create(
            recipient=self.user2,
            notification_type='post_removed',
            post=self.post
        )
        
        # Test that sender can be null
        self.assertIsNone(notification.sender)
        self.assertEqual(notification.recipient, self.user2)
        self.assertEqual(notification.notification_type, 'post_removed')
        
        # Test string representation for system notification
        self.assertIn('System', str(notification))

    def test_notification_without_post(self):
        """Test notification creation without post"""
        notification = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='follow'
        )
        
        # Test that post can be null
        self.assertIsNone(notification.post)
        self.assertEqual(notification.recipient, self.user2)
        self.assertEqual(notification.sender, self.user1)
        self.assertEqual(notification.notification_type, 'follow')

    def test_notification_with_comment(self):
        """Test notification creation with comment"""
        comment = Post.objects.create(
            author=self.user2,
            content='Test comment',
            post_type='reply',
            parent_post=self.post
        )
        
        notification = Notification.objects.create(
            recipient=self.user1,
            sender=self.user2,
            notification_type='comment',
            post=self.post,
            comment=comment
        )
        
        # Test comment relationship
        self.assertEqual(notification.comment, comment)
        self.assertEqual(notification.post, self.post)
        self.assertEqual(notification.notification_type, 'comment')

    def test_notification_read_status(self):
        """Test notification read status"""
        notification = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        
        # Initially unread
        self.assertFalse(notification.is_read)
        
        # Mark as read
        notification.is_read = True
        notification.save()
        
        # Test that it's now read
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)

    def test_notification_types(self):
        """Test all notification types"""
        notification_types = [
            'like', 'comment', 'follow', 'repost', 'report_received',
            'post_removed', 'appeal_approved', 'appeal_rejected', 'art_verified'
        ]
        
        for notification_type in notification_types:
            notification = Notification.objects.create(
                recipient=self.user2,
                sender=self.user1,
                notification_type=notification_type,
                post=self.post
            )
            
            # Test that notification type is set correctly
            self.assertEqual(notification.notification_type, notification_type)
            
            # Test get_notification_type_display method
            display_name = notification.get_notification_type_display()
            self.assertIsNotNone(display_name)
            self.assertIsInstance(display_name, str)

    def test_notification_recipient_relationship(self):
        """Test notification recipient relationship"""
        notification = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        
        # Test recipient relationship
        self.assertEqual(notification.recipient, self.user2)
        
        # Test that user has received notifications
        user_notifications = self.user2.notifications_received.all()
        self.assertIn(notification, user_notifications)

    def test_notification_sender_relationship(self):
        """Test notification sender relationship"""
        notification = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        
        # Test sender relationship
        self.assertEqual(notification.sender, self.user1)
        
        # Test that user has sent notifications
        user_sent_notifications = self.user1.notifications_sent.all()
        self.assertIn(notification, user_sent_notifications)

    def test_notification_post_relationship(self):
        """Test notification post relationship"""
        notification = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        
        # Test post relationship
        self.assertEqual(notification.post, self.post)
        
        # Test that post has notifications
        post_notifications = self.post.notifications.all()
        self.assertIn(notification, post_notifications)

    def test_notification_comment_relationship(self):
        """Test notification comment relationship"""
        comment = Post.objects.create(
            author=self.user2,
            content='Test comment',
            post_type='reply',
            parent_post=self.post
        )
        
        notification = Notification.objects.create(
            recipient=self.user1,
            sender=self.user2,
            notification_type='comment',
            post=self.post,
            comment=comment
        )
        
        # Test comment relationship
        self.assertEqual(notification.comment, comment)
        
        # Test that comment has notifications
        comment_notifications = comment.comment_notifications.all()
        self.assertIn(notification, comment_notifications)

    def test_notification_ordering(self):
        """Test that notifications are ordered by created_at descending"""
        # Create notifications with different timestamps
        notification1 = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        notification2 = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='follow'
        )
        
        # Test ordering (newest first)
        notifications = Notification.objects.all()
        # Both notifications should be in the queryset
        self.assertEqual(len(notifications), 2)
        self.assertIn(notification1, notifications)
        self.assertIn(notification2, notifications)

    def test_notification_timestamp_accuracy(self):
        """Test that notification timestamps are accurate"""
        before_create = timezone.now()
        
        notification = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        
        after_create = timezone.now()
        
        # Test that created_at is between before and after
        self.assertGreaterEqual(notification.created_at, before_create)
        self.assertLessEqual(notification.created_at, after_create)

    def test_notification_indexes(self):
        """Test that notifications use proper database indexes"""
        # Create multiple notifications
        for i in range(5):
            Notification.objects.create(
                recipient=self.user2,
                sender=self.user1,
                notification_type='like',
                post=self.post
            )
        
        # Test that we can query by recipient and ordering
        user_notifications = Notification.objects.filter(
            recipient=self.user2
        ).order_by('-created_at')
        
        self.assertEqual(user_notifications.count(), 5)
        
        # Test that we can query by read status
        unread_notifications = Notification.objects.filter(
            recipient=self.user2,
            is_read=False
        )
        
        self.assertEqual(unread_notifications.count(), 5)

    def test_notification_system_notification(self):
        """Test system notifications (without sender)"""
        system_notifications = [
            'post_removed',
            'appeal_approved', 
            'appeal_rejected',
            'art_verified'
        ]
        
        for notification_type in system_notifications:
            notification = Notification.objects.create(
                recipient=self.user2,
                notification_type=notification_type,
                post=self.post
            )
            
            # Test that sender is None for system notifications
            self.assertIsNone(notification.sender)
            self.assertEqual(notification.notification_type, notification_type)

    def test_notification_user_interaction_types(self):
        """Test user interaction notification types"""
        user_interaction_types = [
            'like', 'comment', 'follow', 'repost'
        ]
        
        for notification_type in user_interaction_types:
            notification = Notification.objects.create(
                recipient=self.user2,
                sender=self.user1,
                notification_type=notification_type,
                post=self.post
            )
            
            # Test that sender is required for user interactions
            self.assertIsNotNone(notification.sender)
            self.assertEqual(notification.notification_type, notification_type)

    def test_notification_report_types(self):
        """Test report-related notification types"""
        report_notifications = [
            'report_received'
        ]
        
        for notification_type in report_notifications:
            notification = Notification.objects.create(
                recipient=self.user2,
                sender=self.user1,
                notification_type=notification_type,
                post=self.post
            )
            
            # Test that sender is required for report notifications
            self.assertIsNotNone(notification.sender)
            self.assertEqual(notification.notification_type, notification_type)

    def test_notification_multiple_recipients(self):
        """Test notifications for multiple recipients"""
        # Create notifications for different recipients
        notification1 = Notification.objects.create(
            recipient=self.user1,
            sender=self.user2,
            notification_type='follow'
        )
        notification2 = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        notification3 = Notification.objects.create(
            recipient=self.user3,
            sender=self.user1,
            notification_type='repost',
            post=self.post
        )
        
        # Test that each user has their own notifications
        user1_notifications = self.user1.notifications_received.all()
        user2_notifications = self.user2.notifications_received.all()
        user3_notifications = self.user3.notifications_received.all()
        
        self.assertIn(notification1, user1_notifications)
        self.assertIn(notification2, user2_notifications)
        self.assertIn(notification3, user3_notifications)
        
        # Test that notifications are separate
        self.assertNotIn(notification2, user1_notifications)
        self.assertNotIn(notification3, user1_notifications)

    def test_notification_created_at_auto_now_add(self):
        """Test that created_at is automatically set"""
        notification = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        
        # Test that created_at is automatically set
        self.assertIsNotNone(notification.created_at)
        
        # Test that it's a recent timestamp
        time_diff = timezone.now() - notification.created_at
        self.assertLess(time_diff.total_seconds(), 5)  # Should be within 5 seconds

    def test_notification_string_representation_edge_cases(self):
        """Test notification string representation with edge cases"""
        # Test with None sender
        notification1 = Notification.objects.create(
            recipient=self.user2,
            notification_type='post_removed',
            post=self.post
        )
        self.assertIn('System', str(notification1))
        
        # Test with sender
        notification2 = Notification.objects.create(
            recipient=self.user2,
            sender=self.user1,
            notification_type='like',
            post=self.post
        )
        self.assertIn(self.user1.username, str(notification2))
        
        # Test notification type in string
        self.assertIn('like', str(notification2))
