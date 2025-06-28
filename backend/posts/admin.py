from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.utils.timesince import timesince
from django.urls import reverse
from .models import Post, EvidenceFile

class EvidenceFileInline(admin.TabularInline):
    model = EvidenceFile
    extra = 0
    readonly_fields = ('preview', 'file_type', 'created_at')
    fields = ('preview', 'file', 'file_type', 'created_at')
    classes = ['collapse']
    verbose_name = "Evidence File"
    verbose_name_plural = "Evidence Files (Click to expand)"

    def preview(self, obj):
        if not obj.file:
            return '-'
        if obj.file_type == 'image':
            return format_html(
                '<div style="margin: 10px 0;">'
                '<img src="{}" style="max-height: 200px; border: 1px solid #ddd; border-radius: 4px; padding: 5px;" /><br/>'
                '<a href="{}" target="_blank" class="button">View Full Size</a>'
                '</div>',
                obj.file.url, obj.file.url
            )
        elif obj.file_type == 'video':
            return format_html(
                '<div style="margin: 10px 0;">'
                '<video src="{}" style="max-height: 200px;" controls></video><br/>'
                '<a href="{}" target="_blank" class="button">Download Video</a>'
                '</div>',
                obj.file.url, obj.file.url
            )
        return format_html(
            '<div style="margin: 10px 0;">'
            '<i class="fas fa-file text-4xl"></i><br/>'
            '<a href="{}" target="_blank" class="button">Download File</a>'
            '</div>',
            obj.file.url
        )
    preview.short_description = 'Preview'

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('id', 'author', 'post_type', 'is_human_drawing', 'is_verified', 'verification_status', 'time_ago', 'list_image_preview', 'evidence_files_preview')
    list_filter = ('is_human_drawing', 'post_type', 'is_verified', 'created_at')
    search_fields = ('author__username', 'content')
    readonly_fields = ('created_at', 'updated_at', 'likes_count', 'reposts_count', 'replies_count', 'detail_image_preview', 'evidence_count')
    fieldsets = (
        ('Post Information', {
            'fields': ('author', 'content', ('image', 'detail_image_preview'))
        }),
        ('Post Type & References', {
            'fields': ('post_type', 'parent_post', 'referenced_post'),
            'classes': ('wide',)
        }),
        ('Verification', {
            'fields': ('is_verified', 'verification_date', 'evidence_count'),
            'classes': ('wide',)
        }),
        ('Statistics', {
            'fields': ('created_at', 'updated_at', 'likes_count', 'reposts_count', 'replies_count'),
            'classes': ('collapse',)
        }),
    )
    inlines = [EvidenceFileInline]
    actions = ['verify_human_drawings', 'reject_human_drawings']

    def linked_id(self, obj):
        url = reverse('admin:posts_post_change', args=[obj.id])
        return format_html('<a href="{}" class="button" style="background-color: #f0f0f0; padding: 5px 10px; border-radius: 4px; text-decoration: none;">Post #{}</a>', url, obj.id)
    linked_id.short_description = 'ID'

    def verification_status(self, obj):
        if obj.is_human_drawing:
            if obj.is_verified:
                return format_html('<span style="color: green; font-weight: bold;">✓ Verified</span>')
            return format_html('<span style="color: orange; font-weight: bold;">⏳ Pending</span>')
        return '-'
    verification_status.short_description = 'Status'

    def time_ago(self, obj):
        if not obj.created_at:
            return '-'
        time_diff = timesince(obj.created_at)
        if not obj.is_human_drawing or obj.is_verified:
            return format_html('<span style="color: #666;">{}</span>', time_diff)
        return format_html('<span style="color: #e67e22; font-weight: 500;">{}</span>', time_diff)
    time_ago.short_description = 'Submitted'
    time_ago.admin_order_field = 'created_at'

    def evidence_files_preview(self, obj):
        if not obj.is_human_drawing:
            return '-'
        evidence_files = obj.evidence_files.all()
        if not evidence_files:
            return 'No evidence files'
        
        html = ['<div style="display: flex; gap: 10px; flex-wrap: wrap;">']
        for ef in evidence_files:
            if ef.file_type == 'image':
                html.append(
                    f'<div style="text-align: center;">'
                    f'<img src="{ef.file.url}" style="max-height: 100px; border: 1px solid #ddd; border-radius: 4px; padding: 2px;" /><br/>'
                    f'<a href="{ef.file.url}" target="_blank" style="font-size: 12px;">View Full</a>'
                    f'</div>'
                )
            elif ef.file_type == 'video':
                html.append(
                    f'<div style="text-align: center;">'
                    f'<video src="{ef.file.url}" style="max-height: 100px;" controls></video><br/>'
                    f'<a href="{ef.file.url}" target="_blank" style="font-size: 12px;">Download</a>'
                    f'</div>'
                )
            else:
                html.append(
                    f'<div style="text-align: center;">'
                    f'<i class="fas fa-file" style="font-size: 24px;"></i><br/>'
                    f'<a href="{ef.file.url}" target="_blank" style="font-size: 12px;">Download</a>'
                    f'</div>'
                )
        html.append('</div>')
        return format_html(''.join(html))
    evidence_files_preview.short_description = 'Evidence Files'

    def evidence_count(self, obj):
        count = obj.evidence_files.count()
        return format_html('{} evidence file{} submitted', count, 's' if count != 1 else '')
    evidence_count.short_description = 'Evidence Files'

    def list_image_preview(self, obj):
        first_image = obj.images.first()
        if not first_image:
            return '-'
        return format_html(
            '<div style="text-align: center;">'
            '<img src="{}" style="max-height: 100px;" /><br/>'
            '<a href="{}" target="_blank" style="font-size: 12px;">View Full</a>'
            '</div>',
            first_image.image.url, first_image.image.url
        )
    list_image_preview.short_description = 'Art Preview'

    def detail_image_preview(self, obj):
        first_image = obj.images.first()
        if not first_image:
            return '-'
        return format_html(
            '<div style="margin: 10px 0;">'
            '<img src="{}" style="max-height: 300px; border: 1px solid #ddd; border-radius: 4px; padding: 5px;" /><br/>'
            '<a href="{}" target="_blank" class="button">View Full Size</a>'
            '</div>',
            first_image.image.url, first_image.image.url
        )
    detail_image_preview.short_description = 'Art Preview'

    @admin.action(description='Verify selected human art posts')
    def verify_human_drawings(self, request, queryset):
        updated = 0
        for post in queryset.filter(is_human_drawing=True):
            post.is_verified = True
            post.verification_date = timezone.now()
            post.save(update_fields=['is_verified', 'verification_date'])
            updated += 1
        self.message_user(request, f'{updated} posts were successfully verified.')

    @admin.action(description='Reject selected human art posts')
    def reject_human_drawings(self, request, queryset):
        updated = 0
        for post in queryset.filter(is_human_drawing=True):
            post.is_verified = False
            post.verification_date = None
            post.save(update_fields=['is_verified', 'verification_date'])
            updated += 1
        self.message_user(request, f'{updated} posts were rejected.')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author').prefetch_related('evidence_files', 'images')
