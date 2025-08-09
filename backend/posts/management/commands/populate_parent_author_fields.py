from django.core.management.base import BaseCommand
from posts.models import Post

class Command(BaseCommand):
    help = 'Populate parent_post_author_handle and parent_post_author_username for existing replies'

    def handle(self, *args, **options):
        replies_without_parent_info = Post.objects.filter(
            post_type='reply',
            parent_post__isnull=False,
            parent_post_author_handle__isnull=True
        )
        
        count = 0
        for reply in replies_without_parent_info:
            if reply.parent_post:
                reply.parent_post_author_handle = reply.parent_post.author.handle
                reply.parent_post_author_username = reply.parent_post.author.username
                reply.save()
                count += 1
                self.stdout.write(
                    f'Updated reply {reply.id} with parent author: {reply.parent_post_author_handle}'
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully updated {count} replies')
        )
