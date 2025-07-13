from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.utils.timesince import timesince
from django.urls import reverse
from .models import Post, EvidenceFile, ContentReport, PostAppeal, AppealEvidenceFile
from notifications.services import create_appeal_approved_notification, create_appeal_rejected_notification

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
    search_fields = ('author__handle', 'author__username', 'content')
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


@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'reporter_link', 'reported_post_link', 'report_type', 'status', 'time_ago', 'report_count')
    list_filter = ('report_type', 'status', 'created_at')
    search_fields = ('reporter__handle', 'reporter__username', 'reported_post__content', 'description')
    readonly_fields = ('created_at', 'reporter', 'reported_post', 'report_type', 'description', 'post_preview', 'total_reports_for_post')
    fieldsets = (
        ('Report Information', {
            'fields': ('reporter', 'reported_post', 'report_type', 'description', 'created_at')
        }),
        ('Post Preview', {
            'fields': ('post_preview', 'total_reports_for_post'),
            'classes': ('wide',)
        }),
        ('Resolution', {
            'fields': ('status', 'resolved_at', 'resolved_by'),
            'classes': ('wide',)
        }),
    )
    actions = ['resolve_reports', 'dismiss_reports']

    def reporter_link(self, obj):
        return format_html(
            '<a href="{}" style="color: #417690; text-decoration: none;">@{}</a>',
            reverse('admin:users_user_change', args=[obj.reporter.id]),
            obj.reporter.handle
        )
    reporter_link.short_description = 'Reporter'

    def reported_post_link(self, obj):
        return format_html(
            '<a href="{}" style="color: #417690; text-decoration: none;">Post #{}</a>',
            reverse('admin:posts_post_change', args=[obj.reported_post.id]),
            obj.reported_post.id
        )
    reported_post_link.short_description = 'Post'

    def time_ago(self, obj):
        time_diff = timesince(obj.created_at)
        color = '#e67e22' if obj.status == 'pending' else '#666'
        return format_html('<span style="color: {};">{}</span>', color, time_diff)
    time_ago.short_description = 'Reported'
    time_ago.admin_order_field = 'created_at'

    def report_count(self, obj):
        count = ContentReport.get_report_count_for_post(obj.reported_post)
        color = '#e74c3c' if count >= 3 else '#f39c12' if count >= 2 else '#27ae60'
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, count)
    report_count.short_description = 'Total Reports'

    def post_preview(self, obj):
        post = obj.reported_post
        preview_html = []
        
        # Post author and content
        preview_html.append(f'<div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px; margin: 10px 0;">')
        preview_html.append(f'<strong>@{post.author.handle}</strong> ({post.get_post_type_display()})')
        
        if post.content:
            content_preview = post.content[:200]
            if len(post.content) > 200:
                content_preview += '...'
            preview_html.append(f'<p style="margin: 10px 0;">{content_preview}</p>')
        
        # Post image preview
        first_image = post.images.first()
        if first_image:
            preview_html.append(
                f'<div style="text-align: center; margin: 10px 0;">'
                f'<img src="{first_image.image.url}" style="max-height: 200px; border: 1px solid #ddd; border-radius: 4px; padding: 5px;" /><br/>'
                f'<a href="{first_image.image.url}" target="_blank" style="font-size: 12px;">View Full Size</a>'
                f'</div>'
            )
        
        # Human art status
        if post.is_human_drawing:
            verification_status = "✓ Verified" if post.is_verified else "⏳ Pending"
            preview_html.append(f'<p style="margin: 10px 0;"><strong>Human Art:</strong> {verification_status}</p>')
        
        preview_html.append('</div>')
        return format_html(''.join(preview_html))
    post_preview.short_description = 'Post Preview'

    def total_reports_for_post(self, obj):
        reports = ContentReport.objects.filter(reported_post=obj.reported_post, status='pending')
        report_types = reports.values_list('report_type', flat=True).distinct()
        
        html = ['<div style="margin: 10px 0;">']
        for report_type in report_types:
            count = reports.filter(report_type=report_type).count()
            display_name = dict(ContentReport.REPORT_TYPES).get(report_type, report_type)
            html.append(f'<span style="margin-right: 15px; background-color: #f0f0f0; padding: 5px 10px; border-radius: 4px;">')
            html.append(f'{display_name}: {count}')
            html.append('</span>')
        html.append('</div>')
        return format_html(''.join(html))
    total_reports_for_post.short_description = 'All Reports for This Post'

    @admin.action(description='Resolve selected reports')
    def resolve_reports(self, request, queryset):
        updated = 0
        for report in queryset.filter(status='pending'):
            report.status = 'resolved'
            report.resolved_at = timezone.now()
            report.resolved_by = request.user
            report.save(update_fields=['status', 'resolved_at', 'resolved_by'])
            updated += 1
        self.message_user(request, f'{updated} reports were successfully resolved.')

    @admin.action(description='Dismiss selected reports')
    def dismiss_reports(self, request, queryset):
        updated = 0
        for report in queryset.filter(status='pending'):
            report.status = 'dismissed'
            report.resolved_at = timezone.now()
            report.resolved_by = request.user
            report.save(update_fields=['status', 'resolved_at', 'resolved_by'])
            updated += 1
        self.message_user(request, f'{updated} reports were successfully dismissed.')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('reporter', 'reported_post__author').prefetch_related('reported_post__images')


class AppealEvidenceFileInline(admin.TabularInline):
    model = AppealEvidenceFile
    extra = 0
    readonly_fields = ('preview', 'file_type', 'file_size', 'created_at')
    fields = ('preview', 'file', 'original_filename', 'file_type', 'file_size', 'created_at')
    classes = ['collapse']
    verbose_name = "Evidence File"
    verbose_name_plural = "Evidence Files (Click to expand)"

    def preview(self, obj):
        if obj.file:
            if obj.file_type and obj.file_type.startswith('image/'):
                return format_html(
                    '<img src="{}" style="max-width: 100px; max-height: 100px; border-radius: 4px;" />',
                    obj.file.url
                )
            else:
                return format_html(
                    '<a href="{}" target="_blank" style="color: #417690; text-decoration: none;">'
                    '<i class="fa fa-file"></i> View File</a>',
                    obj.file.url
                )
        return "No file"
    preview.short_description = 'Preview'


@admin.register(PostAppeal)
class PostAppealAdmin(admin.ModelAdmin):
    list_display = ('id', 'post_link', 'author_link', 'status', 'time_ago', 'reviewed_status')
    list_filter = ('status', 'created_at', 'reviewed_at')
    search_fields = ('author__handle', 'author__username', 'post__content', 'appeal_text')
    readonly_fields = ('created_at', 'reviewed_at', 'post_preview', 'report_count_for_post')
    fieldsets = (
        ('Appeal Information', {
            'fields': ('post', 'author', 'appeal_text', 'created_at')
        }),
        ('Post Details', {
            'fields': ('post_preview', 'report_count_for_post'),
            'classes': ('wide',)
        }),
        ('Review', {
            'fields': ('status', 'reviewed_at', 'reviewed_by', 'admin_notes'),
            'classes': ('wide',)
        }),
    )
    inlines = [AppealEvidenceFileInline]
    actions = ['approve_appeals', 'reject_appeals']

    def post_link(self, obj):
        return format_html(
            '<a href="{}" style="color: #417690; text-decoration: none;">Post #{}</a>',
            reverse('admin:posts_post_change', args=[obj.post.id]),
            obj.post.id
        )
    post_link.short_description = 'Post'

    def author_link(self, obj):
        return format_html(
            '<a href="{}" style="color: #417690; text-decoration: none;">@{}</a>',
            reverse('admin:users_user_change', args=[obj.author.id]),
            obj.author.handle
        )
    author_link.short_description = 'Author'

    def time_ago(self, obj):
        time_diff = timesince(obj.created_at)
        color = '#e67e22' if obj.status == 'pending' else '#666'
        return format_html('<span style="color: {};">{}</span>', color, time_diff)
    time_ago.short_description = 'Submitted'
    time_ago.admin_order_field = 'created_at'

    def reviewed_status(self, obj):
        if obj.status == 'pending':
            return format_html('<span style="color: #e67e22;">Pending Review</span>')
        elif obj.status == 'approved':
            reviewer = obj.reviewed_by.username if obj.reviewed_by else 'Unknown'
            return format_html(
                '<span style="color: #27ae60;">Approved</span><br><small>by {}</small>',
                reviewer
            )
        elif obj.status == 'rejected':
            reviewer = obj.reviewed_by.username if obj.reviewed_by else 'Unknown'
            return format_html(
                '<span style="color: #e74c3c;">Rejected</span><br><small>by {}</small>',
                reviewer
            )
        return obj.get_status_display()
    reviewed_status.short_description = 'Review Status'

    def post_preview(self, obj):
        post = obj.post
        html = ['<div style="margin: 10px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">']
        html.append(f'<strong>@{post.author.handle}</strong>')
        html.append(f'<p style="margin: 5px 0;">{post.content[:200]}{"..." if len(post.content) > 200 else ""}</p>')
        
        if post.images.exists():
            html.append('<div style="margin-top: 10px;">')
            for image in post.images.all()[:3]:  # Show max 3 images
                html.append(f'<img src="{image.image.url}" style="max-width: 100px; max-height: 100px; margin-right: 10px; border-radius: 4px;" />')
            html.append('</div>')
        
        html.append(f'<small style="color: #666;">Posted: {post.created_at.strftime("%Y-%m-%d %H:%M")}</small>')
        html.append('</div>')
        return format_html(''.join(html))
    post_preview.short_description = 'Post Preview'

    def report_count_for_post(self, obj):
        from .models import ContentReport
        reports = ContentReport.objects.filter(reported_post=obj.post, status='pending')
        count = reports.count()
        return format_html(
            '<span style="background-color: #e74c3c; color: white; padding: 3px 8px; border-radius: 3px;">{} reports</span>',
            count
        )
    report_count_for_post.short_description = 'Current Reports'

    @admin.action(description='Approve selected appeals (restore posts)')
    def approve_appeals(self, request, queryset):
        from django.db import transaction
        
        updated = 0
        for appeal in queryset.filter(status='pending'):
            try:
                with transaction.atomic():
                    print(f"🔔 [ADMIN] Processing appeal {appeal.id} for post {appeal.post.id} by {appeal.author.username}")
                    
                    # Update appeal status
                    appeal.status = 'approved'
                    appeal.reviewed_by = request.user
                    appeal.reviewed_at = timezone.now()
                    appeal.save()
                    print(f"🔔 [ADMIN] Appeal {appeal.id} marked as approved")
                    
                    # Restore post to timeline by resolving all pending reports for this post
                    pending_reports = ContentReport.objects.filter(reported_post=appeal.post, status='pending')
                    print(f"🔔 [ADMIN] Found {pending_reports.count()} pending reports for post {appeal.post.id}")
                    
                    for report in pending_reports:
                        report.status = 'resolved'
                        report.resolved_at = timezone.now()
                        report.resolved_by = request.user
                        report.save()
                        print(f"🔔 [ADMIN] Resolved report {report.id}")
                    
                    # Send notification to the appeal author
                    try:
                        result = create_appeal_approved_notification(appeal)
                        print(f"🔔 [ADMIN] Appeal approved notification sent to {appeal.author.username}, result: {result}")
                    except Exception as e:
                        print(f"❌ [ADMIN] Error sending appeal approved notification: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        # Don't fail the admin action if notification fails
                    
                    updated += 1
                    print(f"🔔 [ADMIN] Successfully processed appeal {appeal.id}")
                    
            except Exception as e:
                print(f"❌ [ADMIN] Error processing appeal {appeal.id}: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
                
        self.message_user(request, f'{updated} appeals were approved and posts restored to timeline.')

    @admin.action(description='Reject selected appeals')
    def reject_appeals(self, request, queryset):
        from django.db import transaction
        
        updated = 0
        for appeal in queryset.filter(status='pending'):
            try:
                with transaction.atomic():
                    print(f"🔔 [ADMIN] Processing appeal rejection {appeal.id} for post {appeal.post.id} by {appeal.author.username}")
                    
                    # Update appeal status
                    appeal.status = 'rejected'
                    appeal.reviewed_by = request.user
                    appeal.reviewed_at = timezone.now()
                    appeal.save()
                    print(f"🔔 [ADMIN] Appeal {appeal.id} marked as rejected")
                    
                    # Send notification to the appeal author
                    try:
                        result = create_appeal_rejected_notification(appeal)
                        print(f"🔔 [ADMIN] Appeal rejected notification sent to {appeal.author.username}, result: {result}")
                    except Exception as e:
                        print(f"❌ [ADMIN] Error sending appeal rejected notification: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        # Don't fail the admin action if notification fails
                    
                    updated += 1
                    print(f"🔔 [ADMIN] Successfully processed appeal rejection {appeal.id}")
                    
            except Exception as e:
                print(f"❌ [ADMIN] Error processing appeal rejection {appeal.id}: {str(e)}")
                import traceback
                traceback.print_exc()
                continue
                
        self.message_user(request, f'{updated} appeals were rejected.')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'post', 'author', 'reviewed_by', 'post__author'
        )
