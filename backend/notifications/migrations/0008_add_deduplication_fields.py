# Generated manually for notification deduplication

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0007_notification_content_type_notification_object_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='action_timestamp',
            field=models.DateTimeField(
                default=django.utils.timezone.now,
                help_text='Timestamp of the last action (follow, like, repost) for deduplication'
            ),
        ),
        migrations.AddField(
            model_name='notification',
            name='action_count',
            field=models.PositiveIntegerField(
                default=1,
                help_text='Number of times this action was performed within the deduplication window'
            ),
        ),
        # Add indexes for better performance on deduplication queries
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(
                fields=['recipient', 'sender', 'notification_type', 'action_timestamp'],
                name='notifications_dedup_idx'
            ),
        ),
    ]
