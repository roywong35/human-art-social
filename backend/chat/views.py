from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import Q, Max
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Conversation, Message
from .serializers import ConversationSerializer, ConversationDetailSerializer, MessageSerializer

User = get_user_model()

class ChatPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class ConversationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling conversation operations.
    """
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ChatPagination
    
    def get_queryset(self):
        """
        Get all conversations for the current user.
        """
        return Conversation.objects.filter(
            participants=self.request.user
        ).prefetch_related('participants', 'messages')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def list(self, request, *args, **kwargs):
        """
        List all conversations for the current user.
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        """
        Get a specific conversation with messages.
        """
        conversation = self.get_object()
        serializer = ConversationDetailSerializer(conversation, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=False, methods=['POST'])
    def get_or_create(self, request):
        """
        Get or create a conversation with another user.
        """
        other_user_id = request.data.get('user_id')
        
        if not other_user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if conversation already exists
        conversation = Conversation.objects.filter(
            participants=request.user
        ).filter(
            participants=other_user
        ).first()
        
        if not conversation:
            # Create new conversation
            conversation = Conversation.objects.create()
            conversation.participants.add(request.user, other_user)
        
        serializer = ConversationDetailSerializer(conversation, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=['POST'])
    def send_message(self, request, pk=None):
        """
        Send a message in a conversation.
        """
        conversation = self.get_object()
        
        # Check if user is a participant
        if not conversation.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this conversation'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        content = request.data.get('content', '')
        image = request.FILES.get('image')
        
        if not content and not image:
            return Response(
                {'error': 'Message content or image is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create message
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content,
            image=image
        )
        
        # Broadcast message to WebSocket connections
        channel_layer = get_channel_layer()
        room_group_name = f"chat_{conversation.id}"
        
        # Construct absolute URL for profile picture
        profile_picture_url = None
        if message.sender.profile_picture:
            try:
                profile_picture_url = f"http://localhost:8000{message.sender.profile_picture.url}"
            except:
                profile_picture_url = None
        
        message_data = {
            'id': message.id,
            'content': message.content,
            'sender': {
                'id': message.sender.id,
                'username': message.sender.username,
                'handle': message.sender.handle,
                'profile_picture': profile_picture_url
            },
            'created_at': message.created_at.isoformat(),
            'is_read': message.is_read,
            'image_url': message.image.url if message.image else None
        }
        
        async_to_sync(channel_layer.group_send)(
            room_group_name,
            {
                'type': 'chat_message',
                'message': message_data
            }
        )
        
        # Send global chat notifications to other participants

        other_participants = conversation.participants.exclude(id=request.user.id)
        
        for participant in other_participants:
            async_to_sync(channel_layer.group_send)(
                f"chat_notifications_{participant.id}",
                {
                    'type': 'chat_notification',
                    'notification': {
                        'conversation_id': conversation.id,
                        'sender': {
                            'id': message.sender.id,
                            'username': message.sender.username,
                            'handle': message.sender.handle,
                            'profile_picture': profile_picture_url
                        },
                        'content': message.content,
                        'created_at': message.created_at.isoformat()
                    }
                }
            )

        
        serializer = MessageSerializer(message, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['GET'])
    def messages(self, request, pk=None):
        """
        Get messages for a conversation with pagination.
        """
        conversation = self.get_object()
        
        # Check if user is a participant
        if not conversation.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this conversation'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        messages = conversation.messages.all()
        
        # Apply pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(messages, request)
        
        if page is not None:
            serializer = MessageSerializer(page, many=True, context=self.get_serializer_context())
            return paginator.get_paginated_response(serializer.data)
        
        serializer = MessageSerializer(messages, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=['POST'])
    def mark_as_read(self, request, pk=None):
        """
        Mark all messages in a conversation as read.
        """
        conversation = self.get_object()
        
        # Check if user is a participant
        if not conversation.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this conversation'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Mark all messages as read except those sent by the current user
        conversation.messages.filter(
            is_read=False
        ).exclude(
            sender=request.user
        ).update(is_read=True)
        
        return Response({'message': 'Messages marked as read'})

class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling message operations.
    """
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Get all messages for conversations the user is in.
        """
        user_conversations = Conversation.objects.filter(participants=self.request.user)
        return Message.objects.filter(conversation__in=user_conversations)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=True, methods=['POST'])
    def mark_as_read(self, request, pk=None):
        """
        Mark a specific message as read.
        """
        message = self.get_object()
        
        # Check if user is a participant in the conversation
        if not message.conversation.participants.filter(id=request.user.id).exists():
            return Response(
                {'error': 'You are not a participant in this conversation'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only mark as read if the user is not the sender
        if message.sender != request.user:
            message.is_read = True
            message.save()
        
        return Response({'message': 'Message marked as read'})
