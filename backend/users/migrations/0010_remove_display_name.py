from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0009_set_display_name'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='display_name',
        ),
    ] 