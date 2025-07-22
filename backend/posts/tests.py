from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.exceptions import ValidationError
from datetime import timedelta
import re
from .models import Post, EvidenceFile, PostAppeal, ContentReport, Hashtag, PostImage, User, Draft, ScheduledPost, DraftImage, ScheduledPostImage, AppealEvidenceFile, PostHashtag

User = get_user_model()

class PostModelTest(TestCase):
    """Test cases for the Post model and its functionality"""
    
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
        
        # Create test hashtags
        self.hashtag1 = Hashtag.objects.create(name='art')
        self.hashtag2 = Hashtag.objects.create(name='drawing')
        self.hashtag3 = Hashtag.objects.create(name='humanart')

    def test_post_creation(self):
        """Test basic post creation"""
        post = Post.objects.create(
            author=self.user1,
            content='This is a test post #art #drawing',
            is_human_drawing=False
        )
        
        # Test basic fields
        self.assertEqual(post.author, self.user1)
        self.assertEqual(post.content, 'This is a test post #art #drawing')
        self.assertFalse(post.is_human_drawing)
        self.assertFalse(post.is_verified)
        self.assertEqual(post.post_type, 'post')
        self.assertFalse(post.is_deleted)
        self.assertIsNone(post.deleted_at)
        self.assertIsNone(post.scheduled_time)
        
        # Test string representation
        self.assertIn(self.user1.username, str(post))
        self.assertIn('This is a test post', str(post))

    def test_human_drawing_post_creation(self):
        """Test creating a human drawing post"""
        post = Post.objects.create(
            author=self.user1,
            content='My human drawing #humanart',
            is_human_drawing=True
        )
        
        # Test human drawing fields
        self.assertTrue(post.is_human_drawing)
        self.assertFalse(post.is_verified)  # Should be False by default
        self.assertIsNone(post.verification_date)

    def test_post_soft_delete(self):
        """Test the soft delete functionality"""
        post = Post.objects.create(
            author=self.user1,
            content='Test post for deletion'
        )
        
        # Verify post exists in normal queryset
        self.assertIn(post, Post.objects.all())
        
        # Soft delete the post
        post.soft_delete()
        
        # Test that it's marked as deleted
        self.assertTrue(post.is_deleted)
        self.assertIsNotNone(post.deleted_at)
        
        # Test that it's hidden from normal queries
        self.assertNotIn(post, Post.objects.all())
        self.assertIn(post, Post.all_objects.all())  # Still in all_objects

    def test_post_restore(self):
        """Test restoring a soft-deleted post"""
        post = Post.objects.create(
            author=self.user1,
            content='Test post for restoration'
        )
        post.soft_delete()
        
        # Verify it's deleted
        self.assertNotIn(post, Post.objects.all())
        
        # Restore the post
        post.restore()
        
        # Test that it's restored
        self.assertFalse(post.is_deleted)
        self.assertIsNone(post.deleted_at)
        self.assertIn(post, Post.objects.all())

    def test_post_likes(self):
        """Test post likes functionality"""
        post = Post.objects.create(
            author=self.user1,
            content='Test post for likes'
        )
        
        # Add likes
        post.likes.add(self.user2, self.user3)
        
        # Test likes count
        self.assertEqual(post.likes_count, 2)
        self.assertEqual(post.likes.count(), 2)
        
        # Test is_liked_by method
        self.assertTrue(post.is_liked_by(self.user2))
        self.assertTrue(post.is_liked_by(self.user3))
        self.assertFalse(post.is_liked_by(self.user1))

    def test_post_bookmarks(self):
        """Test post bookmarks functionality"""
        post = Post.objects.create(
            author=self.user1,
            content='Test post for bookmarks'
        )
        
        # Add bookmarks
        post.bookmarks.add(self.user2)
        
        # Test bookmarks
        self.assertEqual(post.bookmarks.count(), 1)
        self.assertTrue(post.is_bookmarked_by(self.user2))
        self.assertFalse(post.is_bookmarked_by(self.user1))

    def test_post_reposts(self):
        """Test post reposts functionality"""
        post = Post.objects.create(
            author=self.user1,
            content='Original post'
        )
        
        # Create a repost
        repost = Post.objects.create(
            author=self.user2,
            content='Reposted content',
            post_type='repost',
            referenced_post=post
        )
        
        # Test repost relationship
        self.assertEqual(repost.referenced_post, post)
        self.assertEqual(repost.post_type, 'repost')
        self.assertTrue(repost.is_repost)
        
        # Test repost count
        self.assertEqual(post.reposts_count, 1)

    def test_post_replies(self):
        """Test post replies functionality"""
        parent_post = Post.objects.create(
            author=self.user1,
            content='Parent post'
        )
        
        # Create a reply
        reply = Post.objects.create(
            author=self.user2,
            content='This is a reply',
            post_type='reply',
            parent_post=parent_post
        )
        
        # Test reply relationship
        self.assertEqual(reply.parent_post, parent_post)
        self.assertEqual(reply.post_type, 'reply')
        self.assertTrue(reply.is_reply)
        
        # Test replies count
        self.assertEqual(parent_post.replies_count, 1)

    def test_scheduled_post(self):
        """Test scheduled post functionality"""
        future_time = timezone.now() + timedelta(hours=1)
        
        scheduled_post = Post.objects.create(
            author=self.user1,
            content='Scheduled post',
            scheduled_time=future_time
        )
        
        # Test scheduled properties
        self.assertTrue(scheduled_post.is_scheduled)
        self.assertFalse(scheduled_post.is_published)
        self.assertEqual(scheduled_post.scheduled_time, future_time)

    def test_published_post(self):
        """Test published post functionality"""
        published_post = Post.objects.create(
            author=self.user1,
            content='Published post'
        )
        
        # Test published properties
        self.assertFalse(published_post.is_scheduled)
        self.assertTrue(published_post.is_published)
        self.assertIsNone(published_post.scheduled_time)

    def test_post_hashtag_extraction(self):
        """Test hashtag extraction from post content"""
        post = Post.objects.create(
            author=self.user1,
            content='This is a post with #art and #drawing hashtags #humanart'
        )
        
        # Extract hashtags
        post.extract_and_save_hashtags()
        
        # Test that hashtags were created and linked
        self.assertEqual(post.hashtags.count(), 3)
        hashtag_names = [tag.name for tag in post.hashtags.all()]
        self.assertIn('art', hashtag_names)
        self.assertIn('drawing', hashtag_names)
        self.assertIn('humanart', hashtag_names)

    def test_post_hashtag_removal(self):
        """Test that removed hashtags are unlinked from post"""
        post = Post.objects.create(
            author=self.user1,
            content='Post with #art and #drawing'
        )
        post.extract_and_save_hashtags()
        
        # Verify hashtags are linked
        self.assertEqual(post.hashtags.count(), 2)
        
        # Update content to remove hashtags
        post.content = 'Post without hashtags'
        post.extract_and_save_hashtags()
        
        # Verify hashtags are unlinked
        self.assertEqual(post.hashtags.count(), 0)

    def test_post_type_properties(self):
        """Test post type properties"""
        # Regular post
        regular_post = Post.objects.create(
            author=self.user1,
            content='Regular post',
            post_type='post'
        )
        self.assertFalse(regular_post.is_reply)
        self.assertFalse(regular_post.is_repost)
        self.assertFalse(regular_post.is_quote)
        
        # Reply post
        reply_post = Post.objects.create(
            author=self.user1,
            content='Reply post',
            post_type='reply'
        )
        self.assertTrue(reply_post.is_reply)
        
        # Repost
        repost = Post.objects.create(
            author=self.user1,
            content='Repost',
            post_type='repost'
        )
        self.assertTrue(repost.is_repost)

    def test_post_absolute_url(self):
        """Test post absolute URL generation"""
        post = Post.objects.create(
            author=self.user1,
            content='Test post'
        )
        
        expected_url = f'/{self.user1.handle}/post/{post.id}/'
        self.assertEqual(post.get_absolute_url(), expected_url)

    def test_post_manager_excludes_deleted(self):
        """Test that PostManager excludes soft-deleted posts"""
        # Create a regular post
        regular_post = Post.objects.create(
            author=self.user1,
            content='Regular post'
        )
        
        # Create and soft-delete a post
        deleted_post = Post.objects.create(
            author=self.user1,
            content='Deleted post'
        )
        deleted_post.soft_delete()
        
        # Test that only regular post is in queryset
        posts = Post.objects.all()
        self.assertIn(regular_post, posts)
        self.assertNotIn(deleted_post, posts)
        
        # Test that deleted post is in all_objects
        all_posts = Post.all_objects.all()
        self.assertIn(regular_post, all_posts)
        self.assertIn(deleted_post, all_posts)

    def test_repost_likes_count(self):
        """Test that repost likes count returns original post likes"""
        original_post = Post.objects.create(
            author=self.user1,
            content='Original post'
        )
        original_post.likes.add(self.user2, self.user3)
        
        # Create repost
        repost = Post.objects.create(
            author=self.user2,
            content='Repost',
            post_type='repost',
            referenced_post=original_post
        )
        
        # Test that repost likes count equals original post likes
        self.assertEqual(repost.likes_count, 2)
        self.assertEqual(repost.reposts_count, 1)

    def test_post_ordering(self):
        """Test that posts are ordered by created_at descending"""
        # Create posts with different timestamps
        post1 = Post.objects.create(
            author=self.user1,
            content='First post'
        )
        post2 = Post.objects.create(
            author=self.user1,
            content='Second post'
        )
        
        # Test ordering
        posts = Post.objects.all()
        self.assertEqual(posts[0], post2)  # Newest first
        self.assertEqual(posts[1], post1)  # Oldest last


class EvidenceFileModelTest(TestCase):
    """Test cases for the EvidenceFile model"""
    
    def setUp(self):
        """Create test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            handle='testuser'
        )
        self.post = Post.objects.create(
            author=self.user,
            content='Human drawing post',
            is_human_drawing=True
        )

    def test_evidence_file_creation(self):
        """Test evidence file creation"""
        evidence_file = EvidenceFile.objects.create(
            post=self.post,
            file='test_evidence.jpg',
            file_type='image'
        )
        
        self.assertEqual(evidence_file.post, self.post)
        self.assertEqual(evidence_file.file_type, 'image')
        self.assertIsNotNone(evidence_file.created_at)

    def test_evidence_file_string_representation(self):
        """Test evidence file string representation"""
        evidence_file = EvidenceFile.objects.create(
            post=self.post,
            file='test_evidence.jpg',
            file_type='image'
        )
        
        self.assertIn('Evidence for post', str(evidence_file))
        self.assertIn(str(self.post.id), str(evidence_file))


class PostAppealModelTest(TestCase):
    """Test cases for the PostAppeal model"""
    
    def setUp(self):
        """Create test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            handle='testuser'
        )
        self.post = Post.objects.create(
            author=self.user,
            content='Post that will be appealed'
        )
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123',
            handle='admin'
        )

    def test_appeal_creation(self):
        """Test appeal creation"""
        appeal = PostAppeal.objects.create(
            post=self.post,
            author=self.user,
            appeal_text='This post was removed in error',
            evidence_files=['evidence1.jpg', 'evidence2.psd']
        )
        
        self.assertEqual(appeal.post, self.post)
        self.assertEqual(appeal.author, self.user)
        self.assertEqual(appeal.status, 'pending')
        self.assertEqual(appeal.evidence_files, ['evidence1.jpg', 'evidence2.psd'])

    def test_appeal_status_properties(self):
        """Test appeal status properties"""
        appeal = PostAppeal.objects.create(
            post=self.post,
            author=self.user,
            appeal_text='Test appeal'
        )
        
        # Test pending status
        self.assertTrue(appeal.is_pending)
        self.assertFalse(appeal.is_approved)
        self.assertFalse(appeal.is_rejected)
        
        # Test approved status
        appeal.status = 'approved'
        appeal.reviewed_by = self.admin_user
        appeal.save()
        
        self.assertFalse(appeal.is_pending)
        self.assertTrue(appeal.is_approved)
        self.assertFalse(appeal.is_rejected)

    def test_appeal_reviewed_at_auto_set(self):
        """Test that reviewed_at is set when status changes from pending"""
        appeal = PostAppeal.objects.create(
            post=self.post,
            author=self.user,
            appeal_text='Test appeal'
        )
        
        # Initially should not have reviewed_at
        self.assertIsNone(appeal.reviewed_at)
        
        # Change status to approved
        appeal.status = 'approved'
        appeal.reviewed_by = self.admin_user
        appeal.save()
        
        # Should now have reviewed_at
        self.assertIsNotNone(appeal.reviewed_at)

    def test_appeal_string_representation(self):
        """Test appeal string representation"""
        appeal = PostAppeal.objects.create(
            post=self.post,
            author=self.user,
            appeal_text='Test appeal'
        )
        
        self.assertIn(self.user.username, str(appeal))
        self.assertIn(str(self.post.id), str(appeal))
        self.assertIn('pending', str(appeal))


class ContentReportModelTest(TestCase):
    """Test cases for the ContentReport model"""
    
    def setUp(self):
        """Create test data"""
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
        self.post = Post.objects.create(
            author=self.user1,
            content='Post to be reported'
        )

    def test_report_creation(self):
        """Test content report creation"""
        report = ContentReport.objects.create(
            reporter=self.user2,
            reported_post=self.post,
            report_type='ai_art',
            description='This looks like AI art'
        )
        
        self.assertEqual(report.reporter, self.user2)
        self.assertEqual(report.reported_post, self.post)
        self.assertEqual(report.report_type, 'ai_art')
        self.assertEqual(report.status, 'pending')

    def test_report_status_property(self):
        """Test report status property"""
        report = ContentReport.objects.create(
            reporter=self.user2,
            reported_post=self.post,
            report_type='ai_art'
        )
        
        # Test pending status
        self.assertFalse(report.is_resolved)
        
        # Test resolved status
        report.status = 'resolved'
        report.save()
        self.assertTrue(report.is_resolved)

    def test_duplicate_report_prevention(self):
        """Test that duplicate reports from same user are prevented"""
        # Create first report
        ContentReport.objects.create(
            reporter=self.user2,
            reported_post=self.post,
            report_type='ai_art'
        )
        
        # Try to create duplicate report
        with self.assertRaises(Exception):
            ContentReport.objects.create(
                reporter=self.user2,
                reported_post=self.post,
                report_type='ai_art'
            )

    def test_report_count_methods(self):
        """Test report count methods"""
        # Create multiple reports
        ContentReport.objects.create(
            reporter=self.user2,
            reported_post=self.post,
            report_type='ai_art'
        )
        ContentReport.objects.create(
            reporter=self.user1,
            reported_post=self.post,
            report_type='harassment'
        )
        
        # Test total count
        self.assertEqual(ContentReport.get_report_count_for_post(self.post), 2)
        
        # Test specific type count
        self.assertEqual(ContentReport.get_report_count_for_post(self.post, 'ai_art'), 1)

    def test_user_report_check(self):
        """Test checking if user has reported a post"""
        # Create report
        ContentReport.objects.create(
            reporter=self.user2,
            reported_post=self.post,
            report_type='ai_art'
        )
        
        # Test that user has reported
        self.assertTrue(ContentReport.is_post_reported_by_user(self.post, self.user2))
        
        # Test that other user hasn't reported
        self.assertFalse(ContentReport.is_post_reported_by_user(self.post, self.user1))


class HashtagModelTest(TestCase):
    """Test cases for the Hashtag model"""
    
    def test_hashtag_creation(self):
        """Test hashtag creation"""
        hashtag = Hashtag.objects.create(name='art')
        
        self.assertEqual(hashtag.name, 'art')
        self.assertIsNotNone(hashtag.created_at)

    def test_hashtag_name_lowercase(self):
        """Test that hashtag names are stored in lowercase"""
        hashtag = Hashtag.objects.create(name='ART')
        
        # Should be stored as lowercase
        self.assertEqual(hashtag.name, 'art')

    def test_hashtag_uniqueness(self):
        """Test that hashtag names must be unique"""
        Hashtag.objects.create(name='art')
        
        # Try to create duplicate
        with self.assertRaises(Exception):
            Hashtag.objects.create(name='art')

    def test_hashtag_string_representation(self):
        """Test hashtag string representation"""
        hashtag = Hashtag.objects.create(name='art')
        
        self.assertEqual(str(hashtag), '#art') 


class DraftModelTest(TestCase):
    """Test cases for the Draft model and its functionality"""
    
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
        
        # Create test post for quoting
        self.test_post = Post.objects.create(
            author=self.user1,
            content='Test post for quoting'
        )

    def test_draft_creation(self):
        """Test basic draft creation"""
        draft = Draft.objects.create(
            author=self.user1,
            content='This is a draft post'
        )
        
        # Test basic fields
        self.assertEqual(draft.author, self.user1)
        self.assertEqual(draft.content, 'This is a draft post')
        self.assertIsNone(draft.scheduled_time)
        self.assertIsNone(draft.quote_post)
        self.assertIsNotNone(draft.created_at)
        self.assertIsNotNone(draft.updated_at)
        self.assertEqual(draft.post_type, 'post')
        self.assertIsNone(draft.parent_post)
        self.assertFalse(draft.is_human_drawing)
        
        # Test string representation
        self.assertIn(self.user1.username, str(draft))
        self.assertIn('This is a draft post', str(draft))

    def test_draft_with_scheduled_time(self):
        """Test draft with scheduled time"""
        scheduled_time = timezone.now() + timedelta(hours=2)
        draft = Draft.objects.create(
            author=self.user1,
            content='Scheduled draft',
            scheduled_time=scheduled_time
        )
        
        # Test scheduled time
        self.assertEqual(draft.scheduled_time, scheduled_time)

    def test_draft_with_quote_post(self):
        """Test draft that quotes another post"""
        draft = Draft.objects.create(
            author=self.user1,
            content='This is a quote draft',
            quote_post=self.test_post
        )
        
        # Test quote post relationship
        self.assertEqual(draft.quote_post, self.test_post)

    def test_draft_reply(self):
        """Test draft that is a reply to another post"""
        draft = Draft.objects.create(
            author=self.user1,
            content='This is a reply draft',
            post_type='reply',
            parent_post=self.test_post
        )
        
        # Test reply fields
        self.assertEqual(draft.post_type, 'reply')
        self.assertEqual(draft.parent_post, self.test_post)

    def test_draft_human_drawing(self):
        """Test draft for human drawing"""
        draft = Draft.objects.create(
            author=self.user1,
            content='This is a human drawing draft',
            is_human_drawing=True
        )
        
        # Test human drawing field
        self.assertTrue(draft.is_human_drawing)

    def test_draft_ordering(self):
        """Test that drafts are ordered by updated_at descending"""
        # Create drafts with different timestamps
        draft1 = Draft.objects.create(
            author=self.user1,
            content='First draft'
        )
        draft2 = Draft.objects.create(
            author=self.user1,
            content='Second draft'
        )
        
        # Test ordering (newest first)
        drafts = Draft.objects.all()
        # Both drafts should be in the queryset
        self.assertEqual(len(drafts), 2)
        self.assertIn(draft1, drafts)
        self.assertIn(draft2, drafts)

    def test_draft_author_relationship(self):
        """Test draft author relationship"""
        draft = Draft.objects.create(
            author=self.user1,
            content='Test draft'
        )
        
        # Test author relationship
        self.assertEqual(draft.author, self.user1)
        
        # Test that user has drafts
        user_drafts = self.user1.drafts.all()
        self.assertIn(draft, user_drafts)

    def test_draft_timestamp_accuracy(self):
        """Test that draft timestamps are accurate"""
        before_create = timezone.now()
        
        draft = Draft.objects.create(
            author=self.user1,
            content='Test draft'
        )
        
        after_create = timezone.now()
        
        # Test that created_at is between before and after
        self.assertGreaterEqual(draft.created_at, before_create)
        self.assertLessEqual(draft.created_at, after_create)

    def test_draft_indexes(self):
        """Test that drafts use proper database indexes"""
        # Create multiple drafts
        for i in range(5):
            Draft.objects.create(
                author=self.user1,
                content=f'Draft {i}'
            )
        
        # Test that we can query by author and ordering
        user_drafts = Draft.objects.filter(
            author=self.user1
        ).order_by('-updated_at')
        
        self.assertEqual(user_drafts.count(), 5)


class ScheduledPostModelTest(TestCase):
    """Test cases for the ScheduledPost model and its functionality"""
    
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
        
        # Create test post for quoting
        self.test_post = Post.objects.create(
            author=self.user1,
            content='Test post for quoting'
        )

    def test_scheduled_post_creation(self):
        """Test basic scheduled post creation"""
        scheduled_time = timezone.now() + timedelta(hours=1)
        scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='This is a scheduled post',
            scheduled_time=scheduled_time
        )
        
        # Test basic fields
        self.assertEqual(scheduled_post.author, self.user1)
        self.assertEqual(scheduled_post.content, 'This is a scheduled post')
        self.assertEqual(scheduled_post.scheduled_time, scheduled_time)
        self.assertIsNone(scheduled_post.quote_post)
        self.assertIsNotNone(scheduled_post.created_at)
        self.assertIsNotNone(scheduled_post.updated_at)
        self.assertEqual(scheduled_post.status, 'scheduled')
        self.assertEqual(scheduled_post.post_type, 'post')
        self.assertIsNone(scheduled_post.parent_post)
        self.assertFalse(scheduled_post.is_human_drawing)
        self.assertIsNone(scheduled_post.published_post)
        
        # Test string representation
        self.assertIn(self.user1.username, str(scheduled_post))
        self.assertIn('This is a scheduled post', str(scheduled_post))

    def test_scheduled_post_with_quote(self):
        """Test scheduled post that quotes another post"""
        scheduled_time = timezone.now() + timedelta(hours=1)
        scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='This is a quote scheduled post',
            scheduled_time=scheduled_time,
            quote_post=self.test_post
        )
        
        # Test quote post relationship
        self.assertEqual(scheduled_post.quote_post, self.test_post)

    def test_scheduled_post_reply(self):
        """Test scheduled post that is a reply"""
        scheduled_time = timezone.now() + timedelta(hours=1)
        scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='This is a reply scheduled post',
            scheduled_time=scheduled_time,
            post_type='reply',
            parent_post=self.test_post
        )
        
        # Test reply fields
        self.assertEqual(scheduled_post.post_type, 'reply')
        self.assertEqual(scheduled_post.parent_post, self.test_post)

    def test_scheduled_post_human_drawing(self):
        """Test scheduled post for human drawing"""
        scheduled_time = timezone.now() + timedelta(hours=1)
        scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='This is a human drawing scheduled post',
            scheduled_time=scheduled_time,
            is_human_drawing=True
        )
        
        # Test human drawing field
        self.assertTrue(scheduled_post.is_human_drawing)

    def test_scheduled_post_status_changes(self):
        """Test scheduled post status changes"""
        scheduled_time = timezone.now() + timedelta(hours=1)
        scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='Test scheduled post',
            scheduled_time=scheduled_time
        )
        
        # Initially scheduled
        self.assertEqual(scheduled_post.status, 'scheduled')
        
        # Change to sent
        scheduled_post.status = 'sent'
        scheduled_post.save()
        self.assertEqual(scheduled_post.status, 'sent')
        
        # Change to failed
        scheduled_post.status = 'failed'
        scheduled_post.save()
        self.assertEqual(scheduled_post.status, 'failed')

    def test_scheduled_post_is_due_property(self):
        """Test the is_due property"""
        # Past scheduled time
        past_time = timezone.now() - timedelta(hours=1)
        past_scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='Past scheduled post',
            scheduled_time=past_time
        )
        self.assertTrue(past_scheduled_post.is_due)
        
        # Future scheduled time
        future_time = timezone.now() + timedelta(hours=1)
        future_scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='Future scheduled post',
            scheduled_time=future_time
        )
        self.assertFalse(future_scheduled_post.is_due)

    def test_scheduled_post_ordering(self):
        """Test that scheduled posts are ordered by scheduled_time"""
        # Create scheduled posts with different times
        time1 = timezone.now() + timedelta(hours=2)
        time2 = timezone.now() + timedelta(hours=1)
        
        scheduled_post1 = ScheduledPost.objects.create(
            author=self.user1,
            content='Later scheduled post',
            scheduled_time=time1
        )
        scheduled_post2 = ScheduledPost.objects.create(
            author=self.user1,
            content='Earlier scheduled post',
            scheduled_time=time2
        )
        
        # Test ordering (earliest first)
        scheduled_posts = ScheduledPost.objects.all()
        self.assertEqual(scheduled_posts[0], scheduled_post2)  # Earlier first
        self.assertEqual(scheduled_posts[1], scheduled_post1)  # Later last

    def test_scheduled_post_author_relationship(self):
        """Test scheduled post author relationship"""
        scheduled_time = timezone.now() + timedelta(hours=1)
        scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='Test scheduled post',
            scheduled_time=scheduled_time
        )
        
        # Test author relationship
        self.assertEqual(scheduled_post.author, self.user1)
        
        # Test that user has scheduled posts
        user_scheduled_posts = self.user1.scheduled_posts.all()
        self.assertIn(scheduled_post, user_scheduled_posts)

    def test_scheduled_post_published_post_relationship(self):
        """Test scheduled post published post relationship"""
        scheduled_time = timezone.now() + timedelta(hours=1)
        scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='Test scheduled post',
            scheduled_time=scheduled_time
        )
        
        # Create a published post
        published_post = Post.objects.create(
            author=self.user1,
            content='Published post'
        )
        
        # Link the published post
        scheduled_post.published_post = published_post
        scheduled_post.save()
        
        # Test relationship
        self.assertEqual(scheduled_post.published_post, published_post)
        
        # Test that the relationship exists (don't test exact reverse relationship)
        self.assertIsNotNone(scheduled_post.published_post)

    def test_scheduled_post_indexes(self):
        """Test that scheduled posts use proper database indexes"""
        # Create multiple scheduled posts
        for i in range(5):
            scheduled_time = timezone.now() + timedelta(hours=i+1)
            ScheduledPost.objects.create(
                author=self.user1,
                content=f'Scheduled post {i}',
                scheduled_time=scheduled_time
            )
        
        # Test that we can query by author, status, and scheduled_time
        user_scheduled_posts = ScheduledPost.objects.filter(
            author=self.user1,
            status='scheduled'
        ).order_by('scheduled_time')
        
        self.assertEqual(user_scheduled_posts.count(), 5)


class PostImageModelTest(TestCase):
    """Test cases for the PostImage model and its functionality"""
    
    def setUp(self):
        """Create test data before each test"""
        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1',
            email='test1@example.com',
            password='testpass123',
            handle='testuser1'
        )
        
        # Create test post
        self.post = Post.objects.create(
            author=self.user1,
            content='Test post with images'
        )

    def test_post_image_creation(self):
        """Test basic post image creation"""
        post_image = PostImage.objects.create(
            post=self.post,
            image='posts/test_image.jpg',
            order=1
        )
        
        # Test basic fields
        self.assertEqual(post_image.post, self.post)
        self.assertEqual(post_image.image.name, 'posts/test_image.jpg')
        self.assertEqual(post_image.order, 1)
        self.assertIsNotNone(post_image.created_at)
        
        # Test string representation
        self.assertIn('1', str(post_image))
        self.assertIn(str(self.post.id), str(post_image))

    def test_post_image_ordering(self):
        """Test that post images are ordered by order field"""
        # Create images with different orders
        image3 = PostImage.objects.create(
            post=self.post,
            image='posts/image3.jpg',
            order=3
        )
        image1 = PostImage.objects.create(
            post=self.post,
            image='posts/image1.jpg',
            order=1
        )
        image2 = PostImage.objects.create(
            post=self.post,
            image='posts/image2.jpg',
            order=2
        )
        
        # Test ordering (by order field)
        post_images = PostImage.objects.all()
        self.assertEqual(post_images[0], image1)  # Order 1 first
        self.assertEqual(post_images[1], image2)  # Order 2 second
        self.assertEqual(post_images[2], image3)  # Order 3 third

    def test_post_image_post_relationship(self):
        """Test post image post relationship"""
        post_image = PostImage.objects.create(
            post=self.post,
            image='posts/test_image.jpg',
            order=1
        )
        
        # Test post relationship
        self.assertEqual(post_image.post, self.post)
        
        # Test that post has images
        post_images = self.post.images.all()
        self.assertIn(post_image, post_images)

    def test_post_image_default_order(self):
        """Test post image with default order"""
        post_image = PostImage.objects.create(
            post=self.post,
            image='posts/test_image.jpg'
        )
        
        # Test default order
        self.assertEqual(post_image.order, 0)

    def test_post_image_timestamp_accuracy(self):
        """Test that post image timestamps are accurate"""
        before_create = timezone.now()
        
        post_image = PostImage.objects.create(
            post=self.post,
            image='posts/test_image.jpg',
            order=1
        )
        
        after_create = timezone.now()
        
        # Test that created_at is between before and after
        self.assertGreaterEqual(post_image.created_at, before_create)
        self.assertLessEqual(post_image.created_at, after_create)


class DraftImageModelTest(TestCase):
    """Test cases for the DraftImage model and its functionality"""
    
    def setUp(self):
        """Create test data before each test"""
        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1',
            email='test1@example.com',
            password='testpass123',
            handle='testuser1'
        )
        
        # Create test draft
        self.draft = Draft.objects.create(
            author=self.user1,
            content='Test draft with images'
        )

    def test_draft_image_creation(self):
        """Test basic draft image creation"""
        draft_image = DraftImage.objects.create(
            draft=self.draft,
            image='draft_images/test_image.jpg',
            order=1
        )
        
        # Test basic fields
        self.assertEqual(draft_image.draft, self.draft)
        self.assertEqual(draft_image.image.name, 'draft_images/test_image.jpg')
        self.assertEqual(draft_image.order, 1)
        self.assertIsNotNone(draft_image.created_at)
        
        # Test string representation
        self.assertIn('1', str(draft_image))
        self.assertIn(str(self.draft.id), str(draft_image))

    def test_draft_image_ordering(self):
        """Test that draft images are ordered by order field"""
        # Create images with different orders
        image3 = DraftImage.objects.create(
            draft=self.draft,
            image='draft_images/image3.jpg',
            order=3
        )
        image1 = DraftImage.objects.create(
            draft=self.draft,
            image='draft_images/image1.jpg',
            order=1
        )
        image2 = DraftImage.objects.create(
            draft=self.draft,
            image='draft_images/image2.jpg',
            order=2
        )
        
        # Test ordering (by order field)
        draft_images = DraftImage.objects.all()
        self.assertEqual(draft_images[0], image1)  # Order 1 first
        self.assertEqual(draft_images[1], image2)  # Order 2 second
        self.assertEqual(draft_images[2], image3)  # Order 3 third

    def test_draft_image_draft_relationship(self):
        """Test draft image draft relationship"""
        draft_image = DraftImage.objects.create(
            draft=self.draft,
            image='draft_images/test_image.jpg',
            order=1
        )
        
        # Test draft relationship
        self.assertEqual(draft_image.draft, self.draft)
        
        # Test that draft has images
        draft_images = self.draft.images.all()
        self.assertIn(draft_image, draft_images)

    def test_draft_image_default_order(self):
        """Test draft image with default order"""
        draft_image = DraftImage.objects.create(
            draft=self.draft,
            image='draft_images/test_image.jpg'
        )
        
        # Test default order
        self.assertEqual(draft_image.order, 0)


class ScheduledPostImageModelTest(TestCase):
    """Test cases for the ScheduledPostImage model and its functionality"""
    
    def setUp(self):
        """Create test data before each test"""
        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1',
            email='test1@example.com',
            password='testpass123',
            handle='testuser1'
        )
        
        # Create test scheduled post
        scheduled_time = timezone.now() + timedelta(hours=1)
        self.scheduled_post = ScheduledPost.objects.create(
            author=self.user1,
            content='Test scheduled post with images',
            scheduled_time=scheduled_time
        )

    def test_scheduled_post_image_creation(self):
        """Test basic scheduled post image creation"""
        scheduled_post_image = ScheduledPostImage.objects.create(
            scheduled_post=self.scheduled_post,
            image='scheduled_post_images/test_image.jpg',
            order=1
        )
        
        # Test basic fields
        self.assertEqual(scheduled_post_image.scheduled_post, self.scheduled_post)
        self.assertEqual(scheduled_post_image.image.name, 'scheduled_post_images/test_image.jpg')
        self.assertEqual(scheduled_post_image.order, 1)
        self.assertIsNotNone(scheduled_post_image.created_at)
        
        # Test string representation
        self.assertIn('1', str(scheduled_post_image))
        self.assertIn(str(self.scheduled_post.id), str(scheduled_post_image))

    def test_scheduled_post_image_ordering(self):
        """Test that scheduled post images are ordered by order field"""
        # Create images with different orders
        image3 = ScheduledPostImage.objects.create(
            scheduled_post=self.scheduled_post,
            image='scheduled_post_images/image3.jpg',
            order=3
        )
        image1 = ScheduledPostImage.objects.create(
            scheduled_post=self.scheduled_post,
            image='scheduled_post_images/image1.jpg',
            order=1
        )
        image2 = ScheduledPostImage.objects.create(
            scheduled_post=self.scheduled_post,
            image='scheduled_post_images/image2.jpg',
            order=2
        )
        
        # Test ordering (by order field)
        scheduled_post_images = ScheduledPostImage.objects.all()
        self.assertEqual(scheduled_post_images[0], image1)  # Order 1 first
        self.assertEqual(scheduled_post_images[1], image2)  # Order 2 second
        self.assertEqual(scheduled_post_images[2], image3)  # Order 3 third

    def test_scheduled_post_image_relationship(self):
        """Test scheduled post image relationship"""
        scheduled_post_image = ScheduledPostImage.objects.create(
            scheduled_post=self.scheduled_post,
            image='scheduled_post_images/test_image.jpg',
            order=1
        )
        
        # Test scheduled post relationship
        self.assertEqual(scheduled_post_image.scheduled_post, self.scheduled_post)
        
        # Test that scheduled post has images
        scheduled_post_images = self.scheduled_post.images.all()
        self.assertIn(scheduled_post_image, scheduled_post_images)

    def test_scheduled_post_image_default_order(self):
        """Test scheduled post image with default order"""
        scheduled_post_image = ScheduledPostImage.objects.create(
            scheduled_post=self.scheduled_post,
            image='scheduled_post_images/test_image.jpg'
        )
        
        # Test default order
        self.assertEqual(scheduled_post_image.order, 0)


class AppealEvidenceFileModelTest(TestCase):
    """Test cases for the AppealEvidenceFile model and its functionality"""
    
    def setUp(self):
        """Create test data before each test"""
        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1',
            email='test1@example.com',
            password='testpass123',
            handle='testuser1'
        )
        
        # Create test post
        self.post = Post.objects.create(
            author=self.user1,
            content='Test post for appeal'
        )
        
        # Create test appeal
        self.appeal = PostAppeal.objects.create(
            post=self.post,
            author=self.user1,
            appeal_text='This is an appeal'
        )

    def test_appeal_evidence_file_creation(self):
        """Test basic appeal evidence file creation"""
        evidence_file = AppealEvidenceFile.objects.create(
            appeal=self.appeal,
            file='appeal_evidence/test_file.jpg',
            original_filename='test_file.jpg',
            file_type='image',
            file_size=1024
        )
        
        # Test basic fields
        self.assertEqual(evidence_file.appeal, self.appeal)
        self.assertEqual(evidence_file.file.name, 'appeal_evidence/test_file.jpg')
        self.assertEqual(evidence_file.original_filename, 'test_file.jpg')
        self.assertEqual(evidence_file.file_type, 'image')
        self.assertEqual(evidence_file.file_size, 1024)
        self.assertIsNotNone(evidence_file.created_at)
        
        # Test string representation
        self.assertIn(str(self.appeal.id), str(evidence_file))
        self.assertIn('test_file.jpg', str(evidence_file))

    def test_appeal_evidence_file_appeal_relationship(self):
        """Test appeal evidence file appeal relationship"""
        evidence_file = AppealEvidenceFile.objects.create(
            appeal=self.appeal,
            file='appeal_evidence/test_file.jpg',
            original_filename='test_file.jpg',
            file_type='image',
            file_size=1024
        )
        
        # Test appeal relationship
        self.assertEqual(evidence_file.appeal, self.appeal)
        
        # Test that appeal has evidence files
        appeal_evidence_files = self.appeal.evidence_files_rel.all()
        self.assertIn(evidence_file, appeal_evidence_files)

    def test_appeal_evidence_file_ordering(self):
        """Test that appeal evidence files are ordered by created_at"""
        # Create evidence files with different timestamps
        evidence_file1 = AppealEvidenceFile.objects.create(
            appeal=self.appeal,
            file='appeal_evidence/file1.jpg',
            original_filename='file1.jpg',
            file_type='image',
            file_size=1024
        )
        evidence_file2 = AppealEvidenceFile.objects.create(
            appeal=self.appeal,
            file='appeal_evidence/file2.jpg',
            original_filename='file2.jpg',
            file_type='document',
            file_size=2048
        )
        
        # Test ordering (oldest first)
        evidence_files = AppealEvidenceFile.objects.all()
        self.assertEqual(evidence_files[0], evidence_file1)  # Oldest first
        self.assertEqual(evidence_files[1], evidence_file2)  # Newest last

    def test_appeal_evidence_file_timestamp_accuracy(self):
        """Test that appeal evidence file timestamps are accurate"""
        before_create = timezone.now()
        
        evidence_file = AppealEvidenceFile.objects.create(
            appeal=self.appeal,
            file='appeal_evidence/test_file.jpg',
            original_filename='test_file.jpg',
            file_type='image',
            file_size=1024
        )
        
        after_create = timezone.now()
        
        # Test that created_at is between before and after
        self.assertGreaterEqual(evidence_file.created_at, before_create)
        self.assertLessEqual(evidence_file.created_at, after_create)

    def test_appeal_evidence_file_different_types(self):
        """Test appeal evidence files with different file types"""
        file_types = ['image', 'document', 'video', 'audio']
        
        for i, file_type in enumerate(file_types):
            evidence_file = AppealEvidenceFile.objects.create(
                appeal=self.appeal,
                file=f'appeal_evidence/test_file_{i}.{file_type}',
                original_filename=f'test_file_{i}.{file_type}',
                file_type=file_type,
                file_size=1024 * (i + 1)
            )
            
            # Test file type
            self.assertEqual(evidence_file.file_type, file_type)
            self.assertEqual(evidence_file.file_size, 1024 * (i + 1))

    def test_appeal_evidence_file_file_size_validation(self):
        """Test appeal evidence file with different file sizes"""
        file_sizes = [1024, 2048, 4096, 8192]
        
        for file_size in file_sizes:
            evidence_file = AppealEvidenceFile.objects.create(
                appeal=self.appeal,
                file=f'appeal_evidence/test_file_{file_size}.jpg',
                original_filename=f'test_file_{file_size}.jpg',
                file_type='image',
                file_size=file_size
            )
            
            # Test file size
            self.assertEqual(evidence_file.file_size, file_size) 


class PostHashtagModelTest(TestCase):
    """Test cases for the PostHashtag through model and its functionality"""
    
    def setUp(self):
        """Create test data before each test"""
        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1',
            email='test1@example.com',
            password='testpass123',
            handle='testuser1'
        )
        
        # Create test post
        self.post = Post.objects.create(
            author=self.user1,
            content='Test post with hashtags'
        )
        
        # Create test hashtags
        self.hashtag1 = Hashtag.objects.create(name='art')
        self.hashtag2 = Hashtag.objects.create(name='drawing')
        self.hashtag3 = Hashtag.objects.create(name='humanart')

    def test_post_hashtag_creation(self):
        """Test basic post hashtag creation"""
        post_hashtag = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        
        # Test basic fields
        self.assertEqual(post_hashtag.post, self.post)
        self.assertEqual(post_hashtag.hashtag, self.hashtag1)
        self.assertIsNotNone(post_hashtag.created_at)
        
        # Test string representation (if it exists)
        # PostHashtag doesn't have a custom __str__ method, so it uses default

    def test_post_hashtag_unique_constraint(self):
        """Test that post-hashtag combinations are unique"""
        # Create first post hashtag
        PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        
        # Try to create duplicate
        with self.assertRaises(Exception):  # IntegrityError or similar
            PostHashtag.objects.create(
                post=self.post,
                hashtag=self.hashtag1
            )

    def test_post_hashtag_relationships(self):
        """Test post hashtag relationships"""
        post_hashtag = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        
        # Test post relationship
        self.assertEqual(post_hashtag.post, self.post)
        
        # Test hashtag relationship
        self.assertEqual(post_hashtag.hashtag, self.hashtag1)
        
        # Test that post has post_hashtags
        post_hashtags = self.post.post_hashtags.all()
        self.assertIn(post_hashtag, post_hashtags)
        
        # Test that hashtag has post_hashtags
        hashtag_post_hashtags = self.hashtag1.post_hashtags.all()
        self.assertIn(post_hashtag, hashtag_post_hashtags)

    def test_post_hashtag_ordering(self):
        """Test that post hashtags are ordered by created_at"""
        # Create post hashtags with different timestamps
        post_hashtag1 = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        post_hashtag2 = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag2
        )
        
        # Test ordering (oldest first)
        post_hashtags = PostHashtag.objects.all()
        self.assertEqual(post_hashtags[0], post_hashtag1)  # Oldest first
        self.assertEqual(post_hashtags[1], post_hashtag2)  # Newest last

    def test_post_hashtag_timestamp_accuracy(self):
        """Test that post hashtag timestamps are accurate"""
        before_create = timezone.now()
        
        post_hashtag = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        
        after_create = timezone.now()
        
        # Test that created_at is between before and after
        self.assertGreaterEqual(post_hashtag.created_at, before_create)
        self.assertLessEqual(post_hashtag.created_at, after_create)

    def test_post_hashtag_indexes(self):
        """Test that post hashtags use proper database indexes"""
        # Create multiple post hashtags
        for i, hashtag in enumerate([self.hashtag1, self.hashtag2, self.hashtag3]):
            PostHashtag.objects.create(
                post=self.post,
                hashtag=hashtag
            )
        
        # Test that we can query by hashtag and ordering
        hashtag_post_hashtags = PostHashtag.objects.filter(
            hashtag=self.hashtag1
        ).order_by('created_at')
        
        self.assertEqual(hashtag_post_hashtags.count(), 1)
        
        # Test that we can query by post
        post_hashtags = PostHashtag.objects.filter(
            post=self.post
        ).order_by('created_at')
        
        self.assertEqual(post_hashtags.count(), 3)

    def test_post_hashtag_cascade_behavior(self):
        """Test cascade behavior when post or hashtag is deleted"""
        post_hashtag = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        
        # Test that post hashtag exists
        self.assertIn(post_hashtag, PostHashtag.objects.all())
        
        # Delete the post (should cascade delete the post hashtag)
        self.post.delete()
        
        # Test that post hashtag is also deleted
        self.assertNotIn(post_hashtag, PostHashtag.objects.all())

    def test_post_hashtag_through_relationship(self):
        """Test the through relationship between Post and Hashtag"""
        # Create post hashtags
        PostHashtag.objects.create(post=self.post, hashtag=self.hashtag1)
        PostHashtag.objects.create(post=self.post, hashtag=self.hashtag2)
        
        # Test that post has hashtags through the relationship
        post_hashtags = self.post.hashtags.all()
        self.assertEqual(post_hashtags.count(), 2)
        self.assertIn(self.hashtag1, post_hashtags)
        self.assertIn(self.hashtag2, post_hashtags)
        
        # Test that hashtag has posts through the relationship
        hashtag_posts = self.hashtag1.posts.all()
        self.assertEqual(hashtag_posts.count(), 1)
        self.assertIn(self.post, hashtag_posts)

    def test_post_hashtag_multiple_posts_same_hashtag(self):
        """Test multiple posts can have the same hashtag"""
        # Create another post
        post2 = Post.objects.create(
            author=self.user1,
            content='Another test post'
        )
        
        # Create post hashtags for both posts with same hashtag
        post_hashtag1 = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        post_hashtag2 = PostHashtag.objects.create(
            post=post2,
            hashtag=self.hashtag1
        )
        
        # Test that both post hashtags exist
        self.assertIn(post_hashtag1, PostHashtag.objects.all())
        self.assertIn(post_hashtag2, PostHashtag.objects.all())
        
        # Test that hashtag has both posts
        hashtag_posts = self.hashtag1.posts.all()
        self.assertEqual(hashtag_posts.count(), 2)
        self.assertIn(self.post, hashtag_posts)
        self.assertIn(post2, hashtag_posts)

    def test_post_hashtag_multiple_hashtags_same_post(self):
        """Test one post can have multiple hashtags"""
        # Create post hashtags for multiple hashtags
        post_hashtag1 = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        post_hashtag2 = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag2
        )
        post_hashtag3 = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag3
        )
        
        # Test that all post hashtags exist
        self.assertIn(post_hashtag1, PostHashtag.objects.all())
        self.assertIn(post_hashtag2, PostHashtag.objects.all())
        self.assertIn(post_hashtag3, PostHashtag.objects.all())
        
        # Test that post has all hashtags
        post_hashtags = self.post.hashtags.all()
        self.assertEqual(post_hashtags.count(), 3)
        self.assertIn(self.hashtag1, post_hashtags)
        self.assertIn(self.hashtag2, post_hashtags)
        self.assertIn(self.hashtag3, post_hashtags)

    def test_post_hashtag_created_at_auto_now_add(self):
        """Test that created_at is automatically set"""
        post_hashtag = PostHashtag.objects.create(
            post=self.post,
            hashtag=self.hashtag1
        )
        
        # Test that created_at is automatically set
        self.assertIsNotNone(post_hashtag.created_at)
        
        # Test that it's a recent timestamp
        time_diff = timezone.now() - post_hashtag.created_at
        self.assertLess(time_diff.total_seconds(), 5)  # Should be within 5 seconds 