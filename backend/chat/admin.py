from django.contrib import admin
from .models import Conversation, Message

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'get_participants', 'created_at', 'last_message_at']
    list_filter = ['created_at', 'last_message_at']
    search_fields = ['participants__username', 'participants__handle']
    readonly_fields = ['created_at', 'updated_at']
    filter_horizontal = ['participants']
    
    def get_participants(self, obj):
        return ', '.join([user.username for user in obj.participants.all()[:2]])
    get_participants.short_description = 'Participants'

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation', 'sender', 'content_preview', 'created_at', 'is_read']
    list_filter = ['created_at', 'is_read']
    search_fields = ['content', 'sender__username', 'sender__handle']
    readonly_fields = ['created_at']
    raw_id_fields = ['conversation', 'sender']
    
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content Preview'
