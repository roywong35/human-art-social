from django.db import migrations

def set_display_name(apps, schema_editor):
    User = apps.get_model('users', 'User')
    for user in User.objects.filter(display_name__isnull=True):
        user.display_name = user.username
        user.save()

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0008_user_display_name'),
    ]

    operations = [
        migrations.RunPython(set_display_name, reverse_code=migrations.RunPython.noop),
    ] 