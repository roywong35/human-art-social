import json
import random
import requests
import tempfile
import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.files import File
from django.conf import settings
from django.core.files.base import ContentFile
User = get_user_model()

class Command(BaseCommand):
    help = 'Generate demo users from JSON data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=10,
            help='Number of users to generate (default: 10)',
        )

    def handle(self, *args, **options):
        # Get user data
        user_data = self.get_demo_users()
        
        # Limit to requested count
        count = min(options['count'], len(user_data))
        user_data = user_data[:count]

        users_created = 0

        for i, user_info in enumerate(user_data):
            try:
                # Extract user data
                username = user_info.get('username', '')
                handle = user_info.get('handle', '')
                email = user_info.get('email', '')
                password = user_info.get('password', '')

                # Validate required fields
                if not all([username, handle, email, password]):
                    self.stdout.write(
                        self.style.WARNING(f'⚠️ Skipping user {i+1}: Missing required fields')
                    )
                    continue

                # Check if user already exists
                if User.objects.filter(handle=handle).exists():
                    self.stdout.write(
                        self.style.WARNING(f'⚠️ Skipping user {username}: Handle {handle} already exists')
                    )
                    continue

                if User.objects.filter(email=email).exists():
                    self.stdout.write(
                        self.style.WARNING(f'⚠️ Skipping user {username}: Email {email} already exists')
                    )
                    continue

                # Create user
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    handle=handle,
                    is_active=True
                )

                # Add random profile picture and banner image (optional)
                self.add_random_profile_picture(user)
                self.add_random_banner_image(user)
                
                # Add random bio
                self.add_random_bio(user)

                users_created += 1
                self.stdout.write(f"✅ Created user: {username} (@{handle})")

                if (i + 1) % 10 == 0:
                    self.stdout.write(f"📊 Progress: {i + 1}/{count} users created...")

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Error creating user {i+1}: {e}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'🎉 Successfully created {users_created} users!'
            )
        )

        # Show login info
        if users_created > 0:
            self.stdout.write('\n📋 Login Information:')
            self.stdout.write('=' * 50)
            for user_info in user_data[:min(5, users_created)]:  # Show first 5
                handle = user_info.get('handle', '')
                password = user_info.get('password', '')
                self.stdout.write(f'Handle: @{handle} | Password: {password}')
            
            if users_created > 5:
                self.stdout.write(f'... and {users_created - 5} more users')

    def get_demo_users(self):
        """100 demo users for interviews - paste your LLM-generated users here"""
        return [
            # TODO: Replace these with your LLM-generated 100 users
            # Format: {"username": "Display Name", "handle": "unique_handle", "email": "handle@email.com", "password": "handle123"}
            
            # Sample users (replace with your 100 users from LLM)
            {
                "username": "陽菜🌸",
                "handle": "HinaGlow",
                "email": "HinaGlow@gmail.com",
                "password": "HinaGlow123"
            },
            {
                "username": "海斗🔥",
                "handle": "KaitoVibe",
                "email": "KaitoVibe@gmail.com",
                "password": "KaitoVibe123"
            },
            {
                "username": "夢ちゃん💫",
                "handle": "YumeStar",
                "email": "YumeStar@gmail.com",
                "password": "YumeStar123"
            },
            {
                "username": "空くん",
                "handle": "SoraSky",
                "email": "SoraSky@gmail.com",
                "password": "SoraSky123"
            },
            {
                "username": "リンリン_にゃん",
                "handle": "RinNeko",
                "email": "RinNeko@gmail.com",
                "password": "RinNeko123"
            },
            {
                "username": "彩花✨",
                "handle": "AyaBloom",
                "email": "AyaBloom@gmail.com",
                "password": "AyaBloom123"
            },
            {
                "username": "悠斗⚡",
                "handle": "YutoSpark",
                "email": "YutoSpark@gmail.com",
                "password": "YutoSpark123"
            },
            {
                "username": "みゆ_ちゃん",
                "handle": "MiyuChan",
                "email": "MiyuChan@gmail.com",
                "password": "MiyuChan123"
            },
            {
                "username": "葵🌿",
                "handle": "AoiLeaf",
                "email": "AoiLeaf@gmail.com",
                "password": "AoiLeaf123"
            },
            {
                "username": "カナエ_キラ",
                "handle": "KanaeShine",
                "email": "KanaeShine@gmail.com",
                "password": "KanaeShine123"
            },
            {
                "username": "Luna🌙Vibes",
                "handle": "MoonLuna",
                "email": "MoonLuna@gmail.com",
                "password": "MoonLuna123"
            },
            {
                "username": "JakeTheWave",
                "handle": "WaveJake",
                "email": "WaveJake@gmail.com",
                "password": "WaveJake123"
            },
            {
                "username": "StarKid99",
                "handle": "StarChaser",
                "email": "StarChaser@gmail.com",
                "password": "StarChaser123"
            },
            {
                "username": "Echo🔥Fox",
                "handle": "FoxEcho",
                "email": "FoxEcho@gmail.com",
                "password": "FoxEcho123"
            },
            {
                "username": "Chloe_xoSpark",
                "handle": "SparkChloe",
                "email": "SparkChloe@gmail.com",
                "password": "SparkChloe123"
            },
            {
                "username": "SkyWalker88",
                "handle": "SkyVibe",
                "email": "SkyVibe@gmail.com",
                "password": "SkyVibe123"
            },
            {
                "username": "Nova🌟Queen",
                "handle": "NovaStar",
                "email": "NovaStar@gmail.com",
                "password": "NovaStar123"
            },
            {
                "username": "ZoeTheDreamer",
                "handle": "DreamZoe",
                "email": "DreamZoe@gmail.com",
                "password": "DreamZoe123"
            },
            {
                "username": "Blaze_X99",
                "handle": "BlazeFire",
                "email": "BlazeFire@gmail.com",
                "password": "BlazeFire123"
            },
            {
                "username": "MysticWolf22",
                "handle": "WolfMystic",
                "email": "WolfMystic@gmail.com",
                "password": "WolfMystic123"
            },
            {
                "username": "桜子🌸",
                "handle": "SakuraBloom",
                "email": "SakuraBloom@gmail.com",
                "password": "SakuraBloom123"
            },
            {
                "username": "翔太⚡",
                "handle": "ShotaBolt",
                "email": "ShotaBolt@gmail.com",
                "password": "ShotaBolt123"
            },
            {
                "username": "ひなこ_ぽん",
                "handle": "HinakoPop",
                "email": "HinakoPop@gmail.com",
                "password": "HinakoPop123"
            },
            {
                "username": "楓ちゃん🍁",
                "handle": "KaedeMaple",
                "email": "KaedeMaple@gmail.com",
                "password": "KaedeMaple123"
            },
            {
                "username": "ナオ_キラキラ",
                "handle": "NaoGlimmer",
                "email": "NaoGlimmer@gmail.com",
                "password": "NaoGlimmer123"
            },
            {
                "username": "涼太🌊",
                "handle": "RyotaWave",
                "email": "RyotaWave@gmail.com",
                "password": "RyotaWave123"
            },
            {
                "username": "美咲✨",
                "handle": "MisakiShine",
                "email": "MisakiShine@gmail.com",
                "password": "MisakiShine123"
            },
            {
                "username": "ゆう_にゃん",
                "handle": "YuuNeko",
                "email": "YuuNeko@gmail.com",
                "password": "YuuNeko123"
            },
            {
                "username": "蓮くん🔥",
                "handle": "RenFlame",
                "email": "RenFlame@gmail.com",
                "password": "RenFlame123"
            },
            {
                "username": "アカリ_星",
                "handle": "AkariStar",
                "email": "AkariStar@gmail.com",
                "password": "AkariStar123"
            },
            {
                "username": "Raven_Xo",
                "handle": "RavenVibe",
                "email": "RavenVibe@gmail.com",
                "password": "RavenVibe123"
            },
            {
                "username": "FrostyDawn",
                "handle": "DawnFrost",
                "email": "DawnFrost@gmail.com",
                "password": "DawnFrost123"
            },
            {
                "username": "Viper🔥99",
                "handle": "ViperBlaze",
                "email": "ViperBlaze@gmail.com",
                "password": "ViperBlaze123"
            },
            {
                "username": "IvyMoonlight",
                "handle": "IvyMoon",
                "email": "IvyMoon@gmail.com",
                "password": "IvyMoon123"
            },
            {
                "username": "ShadowWolf_X",
                "handle": "ShadowWolf",
                "email": "ShadowWolf@gmail.com",
                "password": "ShadowWolf123"
            },
            {
                "username": "Ember🌟Glow",
                "handle": "EmberLight",
                "email": "EmberLight@gmail.com",
                "password": "EmberLight123"
            },
            {
                "username": "KixTheVibe",
                "handle": "KixWave",
                "email": "KixWave@gmail.com",
                "password": "KixWave123"
            },
            {
                "username": "Sienna_Xo",
                "handle": "SiennaSpark",
                "email": "SiennaSpark@gmail.com",
                "password": "SiennaSpark123"
            },
            {
                "username": "NeoStar88",
                "handle": "NeoShine",
                "email": "NeoShine@gmail.com",
                "password": "NeoShine123"
            },
            {
                "username": "Zara🌙Dream",
                "handle": "ZaraMoon",
                "email": "ZaraMoon@gmail.com",
                "password": "ZaraMoon123"
            },
            {
                "username": "花音🌺",
                "handle": "KanonFlower",
                "email": "KanonFlower@gmail.com",
                "password": "KanonFlower123"
            },
            {
                "username": "大和⚡",
                "handle": "YamatoBolt",
                "email": "YamatoBolt@gmail.com",
                "password": "YamatoBolt123"
            },
            {
                "username": "さくら_ぽん",
                "handle": "SakuraPop",
                "email": "SakuraPop@gmail.com",
                "password": "SakuraPop123"
            },
            {
                "username": "優花✨",
                "handle": "YukaShine",
                "email": "YukaShine@gmail.com",
                "password": "YukaShine123"
            },
            {
                "username": "ケイ_にゃん",
                "handle": "KeiNeko",
                "email": "KeiNeko@gmail.com",
                "password": "KeiNeko123"
            },
            {
                "username": "遥🌟",
                "handle": "HaruStar",
                "email": "HaruStar@gmail.com",
                "password": "HaruStar123"
            },
            {
                "username": "真琴_キラ",
                "handle": "MakotoGlimmer",
                "email": "MakotoGlimmer@gmail.com",
                "password": "MakotoGlimmer123"
            },
            {
                "username": "光くん🔥",
                "handle": "HikariFlame",
                "email": "HikariFlame@gmail.com",
                "password": "HikariFlame123"
            },
            {
                "username": "ミオ_ちゃん",
                "handle": "MioChan",
                "email": "MioChan@gmail.com",
                "password": "MioChan123"
            },
            {
                "username": "結衣🌸",
                "handle": "YuiBloom",
                "email": "YuiBloom@gmail.com",
                "password": "YuiBloom123"
            },
            {
                "username": "Aria_Xo",
                "handle": "AriaVibe",
                "email": "AriaVibe@gmail.com",
                "password": "AriaVibe123"
            },
            {
                "username": "BlazeTheKid",
                "handle": "BlazeKid",
                "email": "BlazeKid@gmail.com",
                "password": "BlazeKid123"
            },
            {
                "username": "StellarWolf99",
                "handle": "StellarWolf",
                "email": "StellarWolf@gmail.com",
                "password": "StellarWolf123"
            },
            {
                "username": "Dawn🌟Spark",
                "handle": "DawnSpark",
                "email": "DawnSpark@gmail.com",
                "password": "DawnSpark123"
            },
            {
                "username": "Rogue_X88",
                "handle": "RogueVibe",
                "email": "RogueVibe@gmail.com",
                "password": "RogueVibe123"
            },
            {
                "username": "LilaMoonlight",
                "handle": "LilaMoon",
                "email": "LilaMoon@gmail.com",
                "password": "LilaMoon123"
            },
            {
                "username": "VexTheStar",
                "handle": "VexStar",
                "email": "VexStar@gmail.com",
                "password": "VexStar123"
            },
            {
                "username": "Fury🔥Fox",
                "handle": "FuryFox",
                "email": "FuryFox@gmail.com",
                "password": "FuryFox123"
            },
            {
                "username": "Sage_XoGlow",
                "handle": "SageGlow",
                "email": "SageGlow@gmail.com",
                "password": "SageGlow123"
            },
            {
                "username": "NixTheVibe",
                "handle": "NixWave",
                "email": "NixWave@gmail.com",
                "password": "NixWave123"
            },
            {
                "username": "葵花🌻",
                "handle": "AoiSun",
                "email": "AoiSun@gmail.com",
                "password": "AoiSun123"
            },
            {
                "username": "太陽⚡",
                "handle": "TaiyoBolt",
                "email": "TaiyoBolt@gmail.com",
                "password": "TaiyoBolt123"
            },
            {
                "username": "みか_ぽん",
                "handle": "MikaPop",
                "email": "MikaPop@gmail.com",
                "password": "MikaPop123"
            },
            {
                "username": "奈々✨",
                "handle": "NanaShine",
                "email": "NanaShine@gmail.com",
                "password": "NanaShine123"
            },
            {
                "username": "ユキ_にゃん",
                "handle": "YukiNeko",
                "email": "YukiNeko@gmail.com",
                "password": "YukiNeko123"
            },
            {
                "username": "星花🌟",
                "handle": "HoshikaStar",
                "email": "HoshikaStar@gmail.com",
                "password": "HoshikaStar123"
            },
            {
                "username": "健太_キラ",
                "handle": "KentaGlimmer",
                "email": "KentaGlimmer@gmail.com",
                "password": "KentaGlimmer123"
            },
            {
                "username": "風太🔥",
                "handle": "FutaFlame",
                "email": "FutaFlame@gmail.com",
                "password": "FutaFlame123"
            },
            {
                "username": "ハル_ちゃん",
                "handle": "HaruChan",
                "email": "HaruChan@gmail.com",
                "password": "HaruChan123"
            },
            {
                "username": "美月🌸",
                "handle": "MizukiBloom",
                "email": "MizukiBloom@gmail.com",
                "password": "MizukiBloom123"
            },
            {
                "username": "Zest_Xo",
                "handle": "ZestVibe",
                "email": "ZestVibe@gmail.com",
                "password": "ZestVibe123"
            },
            {
                "username": "KadeTheWave",
                "handle": "KadeWave",
                "email": "KadeWave@gmail.com",
                "password": "KadeWave123"
            },
            {
                "username": "StarFox99",
                "handle": "StarFox",
                "email": "StarFox@gmail.com",
                "password": "StarFox123"
            },
            {
                "username": "Vivid🌟Dawn",
                "handle": "VividDawn",
                "email": "VividDawn@gmail.com",
                "password": "VividDawn123"
            },
            {
                "username": "Nyx_X88",
                "handle": "NyxVibe",
                "email": "NyxVibe@gmail.com",
                "password": "NyxVibe123"
            },
            {
                "username": "SableMoonlight",
                "handle": "SableMoon",
                "email": "SableMoon@gmail.com",
                "password": "SableMoon123"
            },
            {
                "username": "JoltTheStar",
                "handle": "JoltStar",
                "email": "JoltStar@gmail.com",
                "password": "JoltStar123"
            },
            {
                "username": "Tide🔥Wolf",
                "handle": "TideWolf",
                "email": "TideWolf@gmail.com",
                "password": "TideWolf123"
            },
            {
                "username": "Faye_XoGlow",
                "handle": "FayeGlow",
                "email": "FayeGlow@gmail.com",
                "password": "FayeGlow123"
            },
            {
                "username": "RynTheVibe",
                "handle": "RynWave",
                "email": "RynWave@gmail.com",
                "password": "RynWave123"
            },
            {
                "username": "梨花🌺",
                "handle": "RikaFlower",
                "email": "RikaFlower@gmail.com",
                "password": "RikaFlower123"
            },
            {
                "username": "悠真⚡",
                "handle": "YumaBolt",
                "email": "YumaBolt@gmail.com",
                "password": "YumaBolt123"
            },
            {
                "username": "あみ_ぽん",
                "handle": "AmiPop",
                "email": "AmiPop@gmail.com",
                "password": "AmiPop123"
            },
            {
                "username": "真由✨",
                "handle": "MayuShine",
                "email": "MayuShine@gmail.com",
                "password": "MayuShine123"
            },
            {
                "username": "ソラ_にゃん",
                "handle": "SoraNeko",
                "email": "SoraNeko@gmail.com",
                "password": "SoraNeko123"
            },
            {
                "username": "月花🌟",
                "handle": "TsukikaStar",
                "email": "TsukikaStar@gmail.com",
                "password": "TsukikaStar123"
            },
            {
                "username": "健_キラ",
                "handle": "KenGlimmer",
                "email": "KenGlimmer@gmail.com",
                "password": "KenGlimmer123"
            },
            {
                "username": "嵐🔥",
                "handle": "ArashiFlame",
                "email": "ArashiFlame@gmail.com",
                "password": "ArashiFlame123"
            },
            {
                "username": "ミナ_ちゃん",
                "handle": "MinaChan",
                "email": "MinaChan@gmail.com",
                "password": "MinaChan123"
            },
            {
                "username": "雫🌸",
                "handle": "ShizukuBloom",
                "email": "ShizukuBloom@gmail.com",
                "password": "ShizukuBloom123"
            },
            {
                "username": "Vex_Xo",
                "handle": "VexXo",
                "email": "VexXo@gmail.com",
                "password": "VexXo123"
            },
            {
                "username": "TalonTheWave",
                "handle": "TalonWave",
                "email": "TalonWave@gmail.com",
                "password": "TalonWave123"
            },
            {
                "username": "StarVibe99",
                "handle": "StarVibe",
                "email": "StarVibe@gmail.com",
                "password": "StarVibe123"
            },
            {
                "username": "Dawn🔥Glow",
                "handle": "DawnGlow",
                "email": "DawnGlow@gmail.com",
                "password": "DawnGlow123"
            },
            {
                "username": "Ryn_X88",
                "handle": "RynX88",
                "email": "RynX88@gmail.com",
                "password": "RynX88123"
            },
            {
                "username": "LunaMoonlight",
                "handle": "LunaMoon",
                "email": "LunaMoon@gmail.com",
                "password": "LunaMoon123"
            },
            {
                "username": "ZestTheStar",
                "handle": "ZestTheStar",
                "email": "ZestTheStar@gmail.com",
                "password": "ZestTheStar123"
            },
            {
                "username": "Blaze🔥Wolf",
                "handle": "BlazeWolf",
                "email": "BlazeWolf@gmail.com",
                "password": "BlazeWolf123"
            },
            {
                "username": "Sia_XoGlow",
                "handle": "SiaGlow",
                "email": "SiaGlow@gmail.com",
                "password": "SiaGlow123"
            },
            {
                "username": "KynTheVibe",
                "handle": "KynWave",
                "email": "KynWave@gmail.com",
                "password": "KynWave123"
            }
        ]

    def add_random_profile_picture(self, user):
        """Add a random placeholder profile picture"""
        try:
            # Generate unique random seed for each user
            random_seed = random.randint(1, 1000)
            avatar_url = f'https://picsum.photos/200/200?random={random_seed}'
            
            # Download the image
            response = requests.get(avatar_url, timeout=10)
            response.raise_for_status()
            
            # Create a filename based on user handle
            filename = f"profile_{user.handle}_{random_seed}.jpg"
            
            # Save the image to the ImageField
            user.profile_picture.save(
                filename,
                ContentFile(response.content),
                save=True
            )
            
        except Exception as e:
            # Don't fail if profile picture fails
            pass

    def add_random_banner_image(self, user):
        """Add a random placeholder banner image"""
        try:
            # Generate unique random seed for each user
            random_seed = random.randint(1001, 2000)  # Different range from profile
            banner_url = f'https://picsum.photos/1200/300?random={random_seed}'
            
            # Download the image
            response = requests.get(banner_url, timeout=10)
            response.raise_for_status()
            
            # Create a filename based on user handle
            filename = f"banner_{user.handle}_{random_seed}.jpg"
            
            # Save the image to the ImageField
            user.banner_image.save(
                filename,
                ContentFile(response.content),
                save=True
            )
            
        except Exception as e:
            # Don't fail if banner image fails
            pass

    def add_random_bio(self, user):
        """Add a random bio for the user"""
        try:
            # Different bio styles based on username characteristics
            username = user.username.lower()
            
            # Check if username contains Japanese characters or emojis
            has_japanese = any(ord(char) > 127 for char in username)
            has_emoji = any(char in '🌸🔥💫🌿🌙🌟✨🌊🌺🍁🌻⚡' for char in username)
            
            if has_japanese or has_emoji:
                # Japanese-style bios
                bio_templates = [
                    "🎨 アートとデザインが大好きです。新しい作品を楽しみにしています！",
                    "✨ クリエイティブな世界を探求中。インスピレーションを共有しましょう！",
                    "🌸 美しいものを見つけるのが趣味です。",
                    "🌟 アートを通じて世界とつながりたい。",
                    "💫 創造性と想像力の力を信じています。",
                    "🌿 自然とアートの調和を追求しています。",
                    "🔥 情熱を持って創作活動に取り組んでいます。",
                    "🌙 夜の静寂の中でアイデアが生まれます。",
                    "🌊 波のように流れるインスピレーション。",
                    "🌺 花のように美しい作品を作りたい。"
                ]
            else:
                # English-style bios
                bio_templates = [
                    "🎨 Passionate about art and creativity. Always exploring new ideas!",
                    "✨ Creative soul seeking inspiration in everyday moments.",
                    "🌟 Turning imagination into reality, one piece at a time.",
                    "🔥 Dedicated to bringing unique visions to life.",
                    "💫 Art is my language, creativity is my voice.",
                    "🌿 Finding beauty in the intersection of nature and design.",
                    "🌙 Night owl artist, creating when the world sleeps.",
                    "🌊 Flowing with creative energy and endless possibilities.",
                    "🌸 Spreading beauty and positivity through art.",
                    "⚡ Sparking creativity and sharing inspiration."
                ]
            
            # Randomly select a bio template
            bio = random.choice(bio_templates)
            
            # Sometimes add a personal touch based on username (30% chance)
            if random.random() < 0.3:
                try:
                    if has_japanese or has_emoji:
                        personal_touches = [
                            f" {user.username} です。よろしくお願いします！",
                            f" {user.username} として活動中。",
                            f" {user.username} の世界へようこそ。"
                        ]
                    else:
                        personal_touches = [
                            f" Hi, I'm {user.username}! 👋",
                            f" {user.username} here, sharing my journey.",
                            f" Welcome to {user.username}'s creative space."
                        ]
                    bio += random.choice(personal_touches)
                except Exception:
                    # If personal touch fails, just use the base bio
                    pass
            
            user.bio = bio
            user.save()
            
        except Exception as e:
            # Don't fail if bio generation fails - set a default bio
            try:
                user.bio = "🎨 Creative artist sharing my journey."
                user.save()
            except Exception:
                pass 