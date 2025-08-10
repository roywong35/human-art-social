from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Max
from .models import Notification
from .serializers import NotificationSerializer, GroupedNotificationSerializer

# Custom pagination for notifications
class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

# Create your views here.

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def list(self, request, *args, **kwargs):
        """Override list to return grouped notifications"""
        queryset = self.get_queryset()
        
        # Group notifications by type, post, and comment
        grouped_data = self._get_grouped_notifications(queryset)
        
        # Serialize grouped data
        serializer = GroupedNotificationSerializer(grouped_data, many=True)
        
        # Apply pagination
        page = self.paginate_queryset(serializer.data)
        if page is not None:
            return self.get_paginated_response(page)
        
        return Response(serializer.data)

    def _get_grouped_notifications(self, queryset):
        """Helper method to group notifications"""
        grouped = {}
        
        for notification in queryset.select_related('sender', 'post', 'comment').prefetch_related('post__images'):
            # Create key for grouping
            if notification.post:
                key = f"{notification.notification_type}_{notification.post.id}"
            elif notification.comment:
                key = f"{notification.notification_type}_{notification.comment.id}"
            else:
                # For notifications without post/comment (like follow), keep as individual
                key = f"{notification.notification_type}_{notification.id}"
            
            if key not in grouped:
                grouped[key] = {
                    'notification_type': notification.notification_type,
                    'users': [],
                    'latest_time': notification.created_at,
                    'is_read': notification.is_read,
                    'notification_ids': [],
                    'notifications': []
                }
                # Only add post and comment if they exist
                if notification.post:
                    grouped[key]['post'] = notification.post
                if notification.comment:
                    grouped[key]['comment'] = notification.comment
            
            # Add user to the group
            if notification.sender:
                # Check if user is already in the group to avoid duplicates
                user_exists = any(user.id == notification.sender.id for user in grouped[key]['users'])
                if not user_exists:
                    grouped[key]['users'].append(notification.sender)
            
            # Update latest time and read status
            if notification.created_at > grouped[key]['latest_time']:
                grouped[key]['latest_time'] = notification.created_at
            
            if not notification.is_read:
                grouped[key]['is_read'] = False
            
            grouped[key]['notification_ids'].append(notification.id)
            grouped[key]['notifications'].append(notification)
        
        # Convert to list and sort by latest time
        result = list(grouped.values())
        result.sort(key=lambda x: x['latest_time'], reverse=True)
        
        return result

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'])
    def mark_group_as_read(self, request):
        """Mark all notifications in a group as read"""
        notification_ids = request.data.get('notification_ids', [])
        if notification_ids:
            self.get_queryset().filter(id__in=notification_ids).update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})
