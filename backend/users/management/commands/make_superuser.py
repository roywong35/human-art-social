from django.core.management.base import BaseCommand
from users.models import User

class Command(BaseCommand):
    help = 'Makes a user a superuser/admin'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username of the user to make admin')

    def handle(self, *args, **options):
        username = options['username']
        try:
            user = User.objects.get(username=username)
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Successfully made {username} an admin'))
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User {username} does not exist')) 