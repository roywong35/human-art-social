from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0018_postimage'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='post',
            name='referenced_comment',
        ),
        migrations.DeleteModel(
            name='Comment',
        ),
    ] 