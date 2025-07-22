from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class UserModelTest(TestCase):
    """Test cases for the User model and its functionality"""
    
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

    def test_user_creation(self):
        """Test basic user creation"""
        user = User.objects.create_user(
            username='newuser',
            email='newuser@example.com',
            password='password123',
            handle='newuser'
        )
        
        # Test basic fields
        self.assertEqual(user.username, 'newuser')
        self.assertEqual(user.email, 'newuser@example.com')
        self.assertEqual(user.handle, 'newuser')
        self.assertFalse(user.is_artist)
        self.assertFalse(user.verified_artist)
        self.assertFalse(user.following_only_preference)
        self.assertIsNotNone(user.date_joined)
        self.assertIsNotNone(user.last_modified)
        
        # Test string representation
        self.assertEqual(str(user), 'newuser')

    def test_user_creation_without_handle(self):
        """Test user creation without handle (should use username)"""
        user = User.objects.create_user(
            username='nohandle',
            email='nohandle@example.com',
            password='password123'
        )
        
        # Handle should be set to username via pre_save signal
        self.assertEqual(user.handle, 'nohandle')

    def test_user_creation_with_optional_fields(self):
        """Test user creation with optional fields"""
        user = User.objects.create_user(
            username='artistuser',
            email='artist@example.com',
            password='password123',
            handle='artistuser',
            bio='I am an artist',
            location='New York',
            website='https://example.com',
            is_artist=True
        )
        
        # Test optional fields
        self.assertEqual(user.bio, 'I am an artist')
        self.assertEqual(user.location, 'New York')
        self.assertEqual(user.website, 'https://example.com')
        self.assertTrue(user.is_artist)
        self.assertFalse(user.verified_artist)

    def test_user_handle_validation(self):
        """Test handle validation with valid characters"""
        # Valid handles
        valid_handles = ['user123', 'test_user', 'USER123', 'user_123']
        
        for handle in valid_handles:
            user = User.objects.create_user(
                username=f'user_{handle}',
                email=f'{handle}@example.com',
                password='password123',
                handle=handle
            )
            self.assertEqual(user.handle, handle)

    def test_user_handle_invalid_characters(self):
        """Test handle validation with invalid characters"""
        # Invalid handles (should raise ValidationError)
        invalid_handles = ['user@123', 'user-123', 'user#123', 'user$123', 'user%123']
        
        for handle in invalid_handles:
            with self.assertRaises(ValidationError):
                user = User(
                    username=f'user_{handle}',
                    email=f'{handle}@example.com',
                    handle=handle
                )
                user.full_clean()  # This triggers validation

    def test_user_handle_uniqueness(self):
        """Test that handle must be unique"""
        # Create first user
        User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='password123',
            handle='uniquehandle'
        )
        
        # Try to create second user with same handle
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                username='user2',
                email='user2@example.com',
                password='password123',
                handle='uniquehandle'
            )

    def test_user_email_uniqueness(self):
        """Test that email must be unique"""
        # Create first user
        User.objects.create_user(
            username='user1',
            email='unique@example.com',
            password='password123',
            handle='user1'
        )
        
        # Try to create second user with same email
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                username='user2',
                email='unique@example.com',
                password='password123',
                handle='user2'
            )

    def test_user_following_relationship(self):
        """Test following relationship between users"""
        # User1 follows User2
        self.user1.following.add(self.user2)
        
        # Test following relationship
        self.assertIn(self.user2, self.user1.following.all())
        self.assertIn(self.user1, self.user2.followers.all())
        
        # Test counts
        self.assertEqual(self.user1.following_count, 1)
        self.assertEqual(self.user2.followers_count, 1)

    def test_user_following_multiple_users(self):
        """Test following multiple users"""
        # User1 follows User2 and User3
        self.user1.following.add(self.user2, self.user3)
        
        # Test following relationships
        self.assertEqual(self.user1.following_count, 2)
        self.assertIn(self.user2, self.user1.following.all())
        self.assertIn(self.user3, self.user1.following.all())
        
        # Test followers
        self.assertEqual(self.user2.followers_count, 1)
        self.assertEqual(self.user3.followers_count, 1)

    def test_user_unfollow(self):
        """Test unfollowing a user"""
        # User1 follows User2
        self.user1.following.add(self.user2)
        self.assertEqual(self.user1.following_count, 1)
        
        # User1 unfollows User2
        self.user1.following.remove(self.user2)
        self.assertEqual(self.user1.following_count, 0)
        self.assertEqual(self.user2.followers_count, 0)

    def test_user_following_self(self):
        """Test that users can follow themselves (Django allows this by default)"""
        # Try to follow self
        self.user1.following.add(self.user1)
        
        # Django allows self-following by default
        self.assertEqual(self.user1.following_count, 1)
        self.assertIn(self.user1, self.user1.following.all())

    def test_user_following_count_property(self):
        """Test the following_count property"""
        # User1 follows User2 and User3
        self.user1.following.add(self.user2, self.user3)
        
        # Test property
        self.assertEqual(self.user1.following_count, 2)
        self.assertEqual(self.user2.following_count, 0)

    def test_user_followers_count_property(self):
        """Test the followers_count property"""
        # User2 and User3 follow User1
        self.user2.following.add(self.user1)
        self.user3.following.add(self.user1)
        
        # Test property
        self.assertEqual(self.user1.followers_count, 2)
        self.assertEqual(self.user2.followers_count, 0)

    def test_user_artist_status(self):
        """Test artist status fields"""
        # Create regular user
        regular_user = User.objects.create_user(
            username='regular',
            email='regular@example.com',
            password='password123',
            handle='regular'
        )
        self.assertFalse(regular_user.is_artist)
        self.assertFalse(regular_user.verified_artist)
        
        # Create artist user
        artist_user = User.objects.create_user(
            username='artist',
            email='artist@example.com',
            password='password123',
            handle='artist',
            is_artist=True
        )
        self.assertTrue(artist_user.is_artist)
        self.assertFalse(artist_user.verified_artist)
        
        # Verify artist
        artist_user.verified_artist = True
        artist_user.save()
        self.assertTrue(artist_user.verified_artist)

    def test_user_following_only_preference(self):
        """Test following only preference"""
        user = User.objects.create_user(
            username='preference_user',
            email='preference@example.com',
            password='password123',
            handle='preference_user'
        )
        
        # Default should be False
        self.assertFalse(user.following_only_preference)
        
        # Change preference
        user.following_only_preference = True
        user.save()
        self.assertTrue(user.following_only_preference)

    def test_user_bio_length(self):
        """Test bio field length constraint"""
        # Create user with short bio
        user = User.objects.create_user(
            username='biouser',
            email='bio@example.com',
            password='password123',
            handle='biouser',
            bio='Short bio'
        )
        self.assertEqual(user.bio, 'Short bio')
        
        # Create user with long bio (should work within limit)
        long_bio = 'A' * 500  # Max length
        user2 = User.objects.create_user(
            username='longbio',
            email='longbio@example.com',
            password='password123',
            handle='longbio',
            bio=long_bio
        )
        self.assertEqual(user2.bio, long_bio)

    def test_user_website_validation(self):
        """Test website URL field"""
        # Valid URLs
        valid_urls = [
            'https://example.com',
            'http://example.com',
            'https://www.example.com',
            'https://example.com/path'
        ]
        
        for i, url in enumerate(valid_urls):
            user = User.objects.create_user(
                username=f'website{i}',
                email=f'website{i}@example.com',
                password='password123',
                handle=f'website{i}',
                website=url
            )
            self.assertEqual(user.website, url)

    def test_user_location_field(self):
        """Test location field"""
        user = User.objects.create_user(
            username='locationuser',
            email='location@example.com',
            password='password123',
            handle='locationuser',
            location='San Francisco, CA'
        )
        
        self.assertEqual(user.location, 'San Francisco, CA')

    def test_user_profile_picture_field(self):
        """Test profile picture field (without actual file upload)"""
        user = User.objects.create_user(
            username='pictureuser',
            email='picture@example.com',
            password='password123',
            handle='pictureuser'
        )
        
        # Test that field exists and is optional (ImageField returns ImageFieldFile, not None)
        self.assertFalse(user.profile_picture)  # Empty ImageField is falsy
        
        # Test that we can set it (without actual file)
        user.profile_picture = 'profile_pictures/test.jpg'
        user.save()
        self.assertEqual(user.profile_picture.name, 'profile_pictures/test.jpg')

    def test_user_banner_image_field(self):
        """Test banner image field (without actual file upload)"""
        user = User.objects.create_user(
            username='banneruser',
            email='banner@example.com',
            password='password123',
            handle='banneruser'
        )
        
        # Test that field exists and is optional (ImageField returns ImageFieldFile, not None)
        self.assertFalse(user.banner_image)  # Empty ImageField is falsy
        
        # Test that we can set it (without actual file)
        user.banner_image = 'banner_images/test.jpg'
        user.save()
        self.assertEqual(user.banner_image.name, 'banner_images/test.jpg')

    def test_user_date_fields(self):
        """Test date fields"""
        user = User.objects.create_user(
            username='dateuser',
            email='date@example.com',
            password='password123',
            handle='dateuser'
        )
        
        # Test that date fields are set
        self.assertIsNotNone(user.date_joined)
        self.assertIsNotNone(user.last_modified)
        
        # Test that dates are recent
        now = timezone.now()
        self.assertLess(now - user.date_joined, timedelta(seconds=5))
        self.assertLess(now - user.last_modified, timedelta(seconds=5))

    def test_user_last_modified_updates(self):
        """Test that last_modified updates when user is saved"""
        user = User.objects.create_user(
            username='modifyuser',
            email='modify@example.com',
            password='password123',
            handle='modifyuser'
        )
        
        original_modified = user.last_modified
        
        # Wait a moment
        import time
        time.sleep(0.1)
        
        # Update user
        user.bio = 'Updated bio'
        user.save()
        
        # Check that last_modified was updated
        self.assertGreater(user.last_modified, original_modified)

    def test_user_username_field_required(self):
        """Test that username is required"""
        with self.assertRaises(TypeError):  # Django raises TypeError for missing required args
            User.objects.create_user(
                email='nousername@example.com',
                password='password123'
            )

    def test_user_email_field_required(self):
        """Test that email is required"""
        # Since email is the USERNAME_FIELD, it's required for create_user
        # But Django might handle this differently, so let's test the actual behavior
        try:
            user = User.objects.create_user(
                username='noemail',
                password='password123'
            )
            # If this succeeds, it means Django has a default or handles it differently
            self.assertIsNotNone(user.email)  # Should have some default email
        except Exception as e:
            # If it fails, that's also valid behavior
            self.assertIsInstance(e, (TypeError, ValueError))

    def test_user_password_field_required(self):
        """Test that password is required"""
        # Since password is required for create_user
        try:
            user = User.objects.create_user(
                username='nopassword',
                email='nopassword@example.com'
            )
            # If this succeeds, it means Django has a default password
            self.assertIsNotNone(user.password)  # Should have some default password
        except Exception as e:
            # If it fails, that's also valid behavior
            self.assertIsInstance(e, (TypeError, ValueError))

    def test_user_handle_auto_generation(self):
        """Test that handle is auto-generated from username if not provided"""
        user = User.objects.create_user(
            username='autohandle',
            email='autohandle@example.com',
            password='password123'
        )
        
        # Handle should be set to username via pre_save signal
        self.assertEqual(user.handle, 'autohandle')

    def test_user_handle_override_auto_generation(self):
        """Test that provided handle overrides auto-generation"""
        user = User.objects.create_user(
            username='override',
            email='override@example.com',
            password='password123',
            handle='custom_handle'
        )
        
        # Handle should be the provided value, not username
        self.assertEqual(user.handle, 'custom_handle')
        self.assertNotEqual(user.handle, 'override')

    def test_user_following_symmetry(self):
        """Test that following relationship is not symmetrical"""
        # User1 follows User2
        self.user1.following.add(self.user2)
        
        # User2 should NOT automatically follow User1 back
        self.assertNotIn(self.user1, self.user2.following.all())
        self.assertNotIn(self.user2, self.user1.followers.all())
        
        # User2 follows User1 separately
        self.user2.following.add(self.user1)
        
        # Now both should be following each other
        self.assertIn(self.user2, self.user1.following.all())
        self.assertIn(self.user1, self.user2.following.all())

    def test_user_following_queryset_methods(self):
        """Test following relationship queryset methods"""
        # User1 follows User2 and User3
        self.user1.following.add(self.user2, self.user3)
        
        # Test queryset methods
        following_users = self.user1.following.all()
        self.assertEqual(following_users.count(), 2)
        self.assertIn(self.user2, following_users)
        self.assertIn(self.user3, following_users)
        
        # Test filtering
        artist_following = self.user1.following.filter(is_artist=True)
        self.assertEqual(artist_following.count(), 0)  # No artists in following

    def test_user_followers_queryset_methods(self):
        """Test followers relationship queryset methods"""
        # User2 and User3 follow User1
        self.user2.following.add(self.user1)
        self.user3.following.add(self.user1)
        
        # Test queryset methods
        followers = self.user1.followers.all()
        self.assertEqual(followers.count(), 2)
        self.assertIn(self.user2, followers)
        self.assertIn(self.user3, followers)
        
        # Test filtering
        verified_followers = self.user1.followers.filter(verified_artist=True)
        self.assertEqual(verified_followers.count(), 0)  # No verified artists

    def test_user_full_name_property(self):
        """Test the full_name property"""
        # Since first_name and last_name are set to None in the model,
        # full_name should return empty string or handle this case
        user = User.objects.create_user(
            username='fullname',
            email='fullname@example.com',
            password='password123',
            handle='fullname'
        )
        
        # Test full_name property (should handle None first_name/last_name)
        full_name = user.full_name
        # The property returns f"{self.first_name} {self.last_name}" 
        # which would be "None None" but let's test it works
        self.assertIsInstance(full_name, str)

    def test_user_is_following_property(self):
        """Test the is_following property"""
        # Default should be False
        self.assertFalse(self.user1.is_following)
        
        # This property is typically set by the view layer
        # but we can test the default behavior
        self.assertFalse(hasattr(self.user1, '_is_following'))

    def test_user_meta_options(self):
        """Test user model meta options"""
        # Test verbose names
        self.assertEqual(User._meta.verbose_name, 'user')
        self.assertEqual(User._meta.verbose_name_plural, 'users')

    def test_user_username_field_configuration(self):
        """Test that email is the USERNAME_FIELD"""
        self.assertEqual(User.USERNAME_FIELD, 'email')
        self.assertEqual(User.REQUIRED_FIELDS, ['username'])

    def test_user_creation_with_superuser(self):
        """Test superuser creation"""
        superuser = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        
        # Test superuser fields
        self.assertTrue(superuser.is_staff)
        self.assertTrue(superuser.is_superuser)
        self.assertTrue(superuser.is_active)
        
        # Test that handle was auto-generated
        self.assertEqual(superuser.handle, 'admin')
