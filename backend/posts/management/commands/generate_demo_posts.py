import json
import random
import requests
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.utils import timezone
from posts.models import Post, PostImage, Hashtag, PostHashtag, EvidenceFile

User = get_user_model()

class Command(BaseCommand):
    help = 'Generate demo posts with random content and images'

    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            choices=['normal', 'human-art'],
            default='normal',
            help='Type of posts to generate (normal or human-art)'
        )
        parser.add_argument(
            '--count',
            type=int,
            default=10,
            help='Number of posts to generate (default: 10)'
        )
        parser.add_argument(
            '--hashtag',
            type=str,
            help='Hashtag to add to all posts (optional)'
        )
        parser.add_argument(
            '--time-pattern',
            choices=['now', 'recent', 'spread', 'burst'],
            default='spread',
            help='Time pattern for post creation (now, recent, spread, burst)'
        )

    def handle(self, *args, **options):
        post_type = options['type']
        count = options['count']
        hashtag = options['hashtag']
        time_pattern = options['time_pattern']

        # Get existing users
        users = User.objects.filter(is_active=True)
        
        if not users.exists():
            self.stdout.write(
                self.style.ERROR('❌ No active users found. Please create users first.')
            )
            return

        self.stdout.write(f"🎨 Generating {count} {post_type} posts...")
        
        posts_created = 0
        images_added = 0

        for i in range(count):
            try:
                # Pick random user
                author = random.choice(users)
                
                # Generate content based on user's language
                content = self.get_content_by_user_language(author, hashtag)
                
                # Create post
                post = Post.objects.create(
                    author=author,
                    content=content,
                    post_type='post',
                    is_human_drawing=(post_type == 'human-art'),
                    is_verified=False,  # Will be verified later for human-art
                    created_at=self.get_post_time(time_pattern, i, count)
                )
                
                # Add images (60% chance for normal posts, ALWAYS for human art)
                if post_type == 'human-art':
                    # Human art posts MUST have images
                    image_count = self.add_random_images(post)
                    images_added += image_count
                    if image_count == 0:
                        self.stdout.write(f"⚠️ Warning: Human art post {post.id} has no images!")
                elif random.random() < 0.6:
                    # Normal posts have 60% chance
                    image_count = self.add_random_images(post)
                    images_added += image_count
                
                # Add hashtag to database if provided
                if hashtag:
                    self.add_hashtag_to_post(post, hashtag)
                
                # Add evidence files for human art posts (optional)
                if post_type == 'human-art' and random.random() < 0.3:
                    self.add_evidence_files(post)
                
                posts_created += 1
                self.stdout.write(f"✅ Created post: {author.username} - {content[:50]}...")
                
                if (i + 1) % 10 == 0:
                    self.stdout.write(f"📊 Progress: {i + 1}/{count} posts created...")
                    
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Error creating post {i+1}: {e}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'🎉 Successfully created {posts_created} posts with {images_added} images!'
            )
        )
        
        if post_type == 'human-art':
            self.stdout.write(
                self.style.WARNING(
                    '⚠️  Human art posts are in pending state. Go to admin to verify them:'
                )
            )
            self.stdout.write('   http://localhost:8000/admin/posts/post/')
            self.stdout.write('   Filter: is_human_drawing=True AND is_verified=False')

    def get_content_by_user_language(self, user, hashtag=None):
        """Generate content based on user's language"""
        username = user.username.lower()
        
        # Check if user has Japanese characters or emojis
        has_japanese = any(ord(char) > 127 for char in username)
        has_emoji = any(char in '🌸🔥💫🌿🌙🌟✨🌊🌺🍁🌻⚡' for char in username)
        
        if has_japanese or has_emoji:
            content = self.get_japanese_content()
        else:
            content = self.get_english_content()
        
        # Add hashtag if provided
        if hashtag:
            clean_hashtag = hashtag.replace('#', '')
            content += f"\n\n#{clean_hashtag}"
        
        return content

    def get_japanese_content(self):
        """Get Japanese content templates"""
        templates = [
            "今日は新しい作品を作りました。色の組み合わせがとても気に入っています。",
            "アートは心の表現ですね。毎日新しい発見があります。",
            "創作活動は本当に楽しいです。インスピレーションが湧いてきます。",
            "美しいものを見つけるのが趣味です。",
            "アートを通じて世界とつながりたい。",
            "創造性と想像力の力を信じています。",
            "自然とアートの調和を追求しています。",
            "情熱を持って創作活動に取り組んでいます。",
            "夜の静寂の中でアイデアが生まれます。",
            "波のように流れるインスピレーション。",
            "花のように美しい作品を作りたい。",
            "今日は特別な一日でした。新しいアイデアが浮かんできました。",
            "アートは人生を豊かにしてくれます。",
            "創作の時間は本当に貴重です。",
            "色と形の世界に魅了されています。"
        ]
        return random.choice(templates)

    def get_english_content(self):
        """Get English content templates"""
        templates = [
            "Just finished this piece after a long day! The colors really came together in the end.",
            "Sometimes the best art comes from unexpected moments.",
            "Feeling inspired today! Sometimes you just need to step back and see things differently.",
            "Art has a way of showing us what we miss in the everyday.",
            "Creative energy is flowing today! New ideas keep coming.",
            "There's something magical about the creative process.",
            "Every piece tells a story. This one is about finding beauty in chaos.",
            "The best art comes from the heart, not just the mind.",
            "Today was a good day for creating. Ideas just kept flowing.",
            "Sometimes you need to break the rules to make something beautiful.",
            "Art is my way of making sense of the world.",
            "There's nothing quite like the feeling of finishing a piece you're proud of.",
            "Creativity is like a muscle - the more you use it, the stronger it gets.",
            "Finding inspiration in the little things today.",
            "The process is just as important as the result.",
            "Sometimes the simplest ideas are the most powerful."
        ]
        return random.choice(templates)

    def add_random_images(self, post):
        """Add random images to post"""
        try:
            # Determine number of images (1-3 for normal, 1-2 for human art)
            image_count = random.randint(1, 3) if not post.is_human_drawing else random.randint(1, 2)
            successful_images = 0
            
            for i in range(image_count):
                # Try multiple image sources if one fails
                image_added = self.try_add_image(post, i)
                if image_added:
                    successful_images += 1
            
            # For human art posts, ensure we have at least one image
            if post.is_human_drawing and successful_images == 0:
                self.stdout.write(f"🔄 Retrying image generation for human art post {post.id}...")
                # Try one more time with more aggressive approach
                for retry in range(3):  # Try 3 more times
                    if self.try_add_image_aggressive(post, 0):
                        successful_images = 1
                        break
            
            return successful_images
            
        except Exception as e:
            self.stdout.write(f"⚠️ Failed to add images to post {post.id}: {e}")
            return 0

    def try_add_image_aggressive(self, post, image_index):
        """More aggressive image generation for human art posts"""
        # Try all sources with longer timeouts
        image_sources = [
            self.get_picsum_image_aggressive,
            self.get_placeholder_image_aggressive,
            self.get_dummy_image
        ]
        
        for source_func in image_sources:
            try:
                if source_func(post, image_index):
                    return True
            except Exception as e:
                continue
        
        return False

    def get_picsum_image_aggressive(self, post, image_index):
        """Get image from Picsum with aggressive retry"""
        try:
            # Generate unique random seed for each image
            random_seed = random.randint(5000, 10000)
            
            # Different sizes for different post types
            if post.is_human_drawing:
                # Human art posts get larger, more detailed images
                width, height = random.choice([(800, 600), (1200, 800), (1000, 1000)])
            else:
                # Normal posts get standard sizes
                width, height = random.choice([(600, 400), (800, 600), (500, 500)])
            
            # Try many different Picsum URLs
            urls_to_try = [
                f'https://picsum.photos/{width}/{height}?random={random_seed}',
                f'https://picsum.photos/{width}/{height}?blur=2&random={random_seed}',
                f'https://picsum.photos/{width}/{height}?grayscale&random={random_seed}',
                f'https://picsum.photos/{width}/{height}?random={random_seed + 1000}',
                f'https://picsum.photos/{width}/{height}?random={random_seed + 2000}',
                f'https://picsum.photos/{width}/{height}?random={random_seed + 3000}'
            ]
            
            for url in urls_to_try:
                try:
                    response = requests.get(url, timeout=20)  # Longer timeout
                    response.raise_for_status()
                    
                    # Create filename
                    filename = f"post_{post.id}_{image_index}_{random_seed}.jpg"
                    
                    # Save the image
                    post_image = PostImage.objects.create(
                        post=post,
                        order=image_index
                    )
                    post_image.image.save(filename, ContentFile(response.content), save=True)
                    return True
                    
                except requests.RequestException:
                    continue
            
            return False
            
        except Exception as e:
            return False

    def get_placeholder_image_aggressive(self, post, image_index):
        """Get image from placeholder.com with aggressive retry"""
        try:
            # Generate unique random seed
            random_seed = random.randint(5000, 10000)
            
            # Different sizes for different post types
            if post.is_human_drawing:
                width, height = random.choice([(800, 600), (1200, 800), (1000, 1000)])
            else:
                width, height = random.choice([(600, 400), (800, 600), (500, 500)])
            
            # Try multiple placeholder URLs
            urls_to_try = [
                f'https://via.placeholder.com/{width}x{height}/random?text=Art+Image+{random_seed}',
                f'https://via.placeholder.com/{width}x{height}/random?text=Art+{random_seed}',
                f'https://via.placeholder.com/{width}x{height}/random?text=Image+{random_seed}'
            ]
            
            for url in urls_to_try:
                try:
                    response = requests.get(url, timeout=20)  # Longer timeout
                    response.raise_for_status()
                    
                    # Create filename
                    filename = f"post_{post.id}_{image_index}_{random_seed}.jpg"
                    
                    # Save the image
                    post_image = PostImage.objects.create(
                        post=post,
                        order=image_index
                    )
                    post_image.image.save(filename, ContentFile(response.content), save=True)
                    return True
                    
                except requests.RequestException:
                    continue
            
            return False
            
        except Exception as e:
            return False

    def try_add_image(self, post, image_index):
        """Try to add a single image with fallback sources"""
        # Multiple image sources to try
        image_sources = [
            self.get_picsum_image,
            self.get_placeholder_image,
            self.get_dummy_image
        ]
        
        for source_func in image_sources:
            try:
                if source_func(post, image_index):
                    return True
            except Exception as e:
                continue
        
        return False

    def get_picsum_image(self, post, image_index):
        """Get image from Picsum with better error handling"""
        try:
            # Generate unique random seed for each image
            random_seed = random.randint(5000, 10000)
            
            # Different sizes for different post types
            if post.is_human_drawing:
                # Human art posts get larger, more detailed images
                width, height = random.choice([(800, 600), (1200, 800), (1000, 1000)])
            else:
                # Normal posts get standard sizes
                width, height = random.choice([(600, 400), (800, 600), (500, 500)])
            
            # Try different Picsum URLs
            urls_to_try = [
                f'https://picsum.photos/{width}/{height}?random={random_seed}',
                f'https://picsum.photos/{width}/{height}?blur=2&random={random_seed}',
                f'https://picsum.photos/{width}/{height}?grayscale&random={random_seed}'
            ]
            
            for url in urls_to_try:
                try:
                    response = requests.get(url, timeout=15)
                    response.raise_for_status()
                    
                    # Create filename
                    filename = f"post_{post.id}_{image_index}_{random_seed}.jpg"
                    
                    # Save the image
                    post_image = PostImage.objects.create(
                        post=post,
                        order=image_index
                    )
                    post_image.image.save(filename, ContentFile(response.content), save=True)
                    return True
                    
                except requests.RequestException:
                    continue
            
            return False
            
        except Exception as e:
            return False

    def get_placeholder_image(self, post, image_index):
        """Get image from placeholder.com as fallback"""
        try:
            # Generate unique random seed
            random_seed = random.randint(5000, 10000)
            
            # Different sizes for different post types
            if post.is_human_drawing:
                width, height = random.choice([(800, 600), (1200, 800), (1000, 1000)])
            else:
                width, height = random.choice([(600, 400), (800, 600), (500, 500)])
            
            url = f'https://via.placeholder.com/{width}x{height}/random?text=Art+Image+{random_seed}'
            
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            
            # Create filename
            filename = f"post_{post.id}_{image_index}_{random_seed}.jpg"
            
            # Save the image
            post_image = PostImage.objects.create(
                post=post,
                order=image_index
            )
            post_image.image.save(filename, ContentFile(response.content), save=True)
            return True
            
        except Exception as e:
            return False

    def get_dummy_image(self, post, image_index):
        """Create a simple colored image as last resort"""
        try:
            from PIL import Image, ImageDraw
            
            # Generate unique random seed
            random_seed = random.randint(5000, 10000)
            
            # Different sizes for different post types
            if post.is_human_drawing:
                width, height = random.choice([(800, 600), (1200, 800), (1000, 1000)])
            else:
                width, height = random.choice([(600, 400), (800, 600), (500, 500)])
            
            # Create a simple colored image
            colors = [
                (255, 99, 132),   # Pink
                (54, 162, 235),   # Blue
                (255, 205, 86),   # Yellow
                (75, 192, 192),   # Green
                (153, 102, 255),  # Purple
                (255, 159, 64),   # Orange
            ]
            
            color = random.choice(colors)
            image = Image.new('RGB', (width, height), color)
            
            # Add some simple shapes
            draw = ImageDraw.Draw(image)
            for _ in range(3):
                x1 = random.randint(0, width)
                y1 = random.randint(0, height)
                x2 = random.randint(0, width)
                y2 = random.randint(0, height)
                draw.ellipse([x1, y1, x2, y2], fill=random.choice(colors))
            
            # Convert to bytes
            import io
            img_io = io.BytesIO()
            image.save(img_io, format='JPEG')
            img_io.seek(0)
            
            # Create filename
            filename = f"post_{post.id}_{image_index}_{random_seed}.jpg"
            
            # Save the image
            post_image = PostImage.objects.create(
                post=post,
                order=image_index
            )
            post_image.image.save(filename, ContentFile(img_io.getvalue()), save=True)
            return True
            
        except Exception as e:
            return False

    def add_hashtag_to_post(self, post, hashtag):
        """Add hashtag to post and create hashtag record"""
        try:
            # Clean hashtag
            clean_hashtag = hashtag.replace('#', '').lower()
            
            # Get or create hashtag
            hashtag_obj, created = Hashtag.objects.get_or_create(name=clean_hashtag)
            
            # Link hashtag to post
            PostHashtag.objects.get_or_create(post=post, hashtag=hashtag_obj)
            
            if created:
                self.stdout.write(f"✅ Created new hashtag: #{clean_hashtag}")
                
        except Exception as e:
            self.stdout.write(f"⚠️ Failed to add hashtag to post {post.id}: {e}")

    def add_evidence_files(self, post):
        """Add evidence files for human art posts"""
        try:
            evidence_types = ['image', 'psd', 'video']
            
            for i in range(random.randint(1, 2)):  # 1-2 evidence files
                evidence_type = random.choice(evidence_types)
                
                # Try to add evidence file with fallback
                if self.try_add_evidence_file(post, i, evidence_type):
                    continue
                
        except Exception as e:
            self.stdout.write(f"⚠️ Failed to add evidence files to post {post.id}: {e}")

    def try_add_evidence_file(self, post, file_index, evidence_type):
        """Try to add evidence file with fallback sources"""
        try:
            # Try Picsum first
            random_seed = random.randint(10000, 15000)
            evidence_url = f'https://picsum.photos/800/600?random={random_seed}'
            
            response = requests.get(evidence_url, timeout=15)
            response.raise_for_status()
            
            filename = f"evidence_{post.id}_{file_index}_{evidence_type}.jpg"
            
            EvidenceFile.objects.create(
                post=post,
                file=ContentFile(response.content, filename),
                file_type=evidence_type
            )
            return True
            
        except requests.RequestException:
            # If Picsum fails, create a simple colored image
            try:
                from PIL import Image, ImageDraw
                
                # Create a simple colored image
                colors = [
                    (255, 99, 132),   # Pink
                    (54, 162, 235),   # Blue
                    (255, 205, 86),   # Yellow
                    (75, 192, 192),   # Green
                    (153, 102, 255),  # Purple
                    (255, 159, 64),   # Orange
                ]
                
                color = random.choice(colors)
                image = Image.new('RGB', (800, 600), color)
                
                # Add some simple shapes
                draw = ImageDraw.Draw(image)
                for _ in range(5):
                    x1 = random.randint(0, 800)
                    y1 = random.randint(0, 600)
                    x2 = random.randint(0, 800)
                    y2 = random.randint(0, 600)
                    draw.ellipse([x1, y1, x2, y2], fill=random.choice(colors))
                
                # Convert to bytes
                import io
                img_io = io.BytesIO()
                image.save(img_io, format='JPEG')
                img_io.seek(0)
                
                filename = f"evidence_{post.id}_{file_index}_{evidence_type}.jpg"
                
                EvidenceFile.objects.create(
                    post=post,
                    file=ContentFile(img_io.getvalue(), filename),
                    file_type=evidence_type
                )
                return True
                
            except Exception as e:
                return False

    def get_post_time(self, time_pattern, post_index, total_posts):
        """Generate appropriate creation time based on pattern"""
        now = timezone.now()
        
        if time_pattern == 'now':
            # All posts at current time (for immediate testing)
            return now
            
        elif time_pattern == 'recent':
            # Posts spread over last 2 hours (for trending testing)
            hours_ago = random.uniform(0, 2)
            return now - timedelta(hours=hours_ago)
            
        elif time_pattern == 'burst':
            # Posts in last 30 minutes (for viral testing)
            minutes_ago = random.uniform(0, 30)
            return now - timedelta(minutes=minutes_ago)
            
        elif time_pattern == 'spread':
            # Posts spread over last 7 days (realistic timeline)
            days_ago = random.uniform(0, 7)
            return now - timedelta(days=days_ago)
        
        # Default fallback
        return now - timedelta(days=random.randint(0, 7)) 