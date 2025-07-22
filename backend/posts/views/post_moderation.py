from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Post, ContentReport, PostAppeal, AppealEvidenceFile
from ..serializers import PostAppealSerializer
from notifications.services import create_report_received_notification, create_post_removed_notification

class PostModerationViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        """Get post by handle and id"""
        handle = self.kwargs.get('handle')
        post_id = self.kwargs.get('pk')
        return get_object_or_404(Post, author__handle=handle, pk=post_id)
    
    @action(detail=True, methods=['POST'])
    def report(self, request, handle=None, pk=None):
        """
        Report a post for inappropriate content
        """
        try:
            post = get_object_or_404(Post, author__handle=handle, pk=pk)
            
            # Check if user is trying to report their own post
            if post.author == request.user:
                return Response(
                    {'error': 'You cannot report your own post'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            report_type = request.data.get('report_type')
            description = request.data.get('description', '')
            
            if not report_type:
                return Response(
                    {'error': 'Report type is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate report type exists
            valid_report_types = dict(ContentReport.REPORT_TYPES)
            if report_type not in valid_report_types:
                return Response(
                    {'error': 'Invalid report type'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if AI Art report is only for human art posts
            if report_type == 'ai_art' and not post.is_human_drawing:
                return Response(
                    {'error': 'AI Art reports can only be made against human art posts'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if user has already reported this post for this reason
            existing_report = ContentReport.objects.filter(
                reporter=request.user,
                reported_post=post,
                report_type=report_type,
                status='pending'
            ).first()
            
            if existing_report:
                return Response(
                    {'error': 'You have already reported this post for this reason'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create the report
            report = ContentReport.objects.create(
                reporter=request.user,
                reported_post=post,
                report_type=report_type,
                description=description
            )
            print(f"🚨 Report created: {report.id} for post {post.id}")
            
            # Send notification to the reporter
            create_report_received_notification(request.user, post)
            
            # Get updated report count
            report_count = ContentReport.get_report_count_for_post(post)
            
            # Check if post should be removed (3+ reports) and send notification to author
            if report_count >= 3:
                print(f"🚨 Post {post.id} has {report_count} reports - sending removal notification")
                try:
                    # Only send notification if author hasn't been notified yet
                    from notifications.models import Notification
                    existing_notification = Notification.objects.filter(
                        recipient=post.author,
                        post=post,
                        notification_type='post_removed'
                    ).first()
                    
                    if not existing_notification:
                        create_post_removed_notification(post)
                        print(f"🚨 Post removal notification sent to {post.author.username}")
                        
                except Exception as e:
                    print(f"❌ Error sending post removal notification: {str(e)}")
                    # Don't fail the report submission if notification fails
            
            return Response({
                'success': True,
                'message': 'Report submitted successfully',
                'report_id': report.id,
                'report_count': report_count,
                'post_id': post.id  # Add post_id for frontend to hide the post
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"❌ Error in report action: {str(e)}")
            return Response(
                {'error': 'An error occurred while submitting the report'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['GET'])
    def report_types(self, request, handle=None, pk=None):
        """
        Get available report types for a specific post
        """
        try:
            post = get_object_or_404(Post, author__handle=handle, pk=pk)
            
            # Get dynamic report types based on post type
            available_types = ContentReport.get_report_types_for_post(post)
            
            # Convert tuples to objects for frontend
            formatted_types = [
                {'value': type_code, 'label': type_label}
                for type_code, type_label in available_types
            ]
            
            return Response({
                'report_types': formatted_types,
                'post_type': post.post_type,
                'is_human_drawing': post.is_human_drawing
            })
            
        except Exception as e:
            print(f"❌ Error in report_types action: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching report types'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['GET'])
    def reported(self, request):
        """
        Get posts that the current user has reported (for hiding from their view)
        """
        try:
            reported_post_ids = ContentReport.get_posts_to_hide_from_user(request.user)
            
            return Response({
                'reported_post_ids': list(reported_post_ids),
                'count': len(reported_post_ids)
            })
            
        except Exception as e:
            print(f"❌ Error in reported action: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching reported posts'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['POST'])
    def appeal(self, request, handle=None, pk=None):
        """
        Create an appeal for a removed post
        """
        try:
            post = get_object_or_404(Post, author__handle=handle, pk=pk)
            
            # Check if user is the post author
            if post.author != request.user:
                return Response(
                    {'error': 'You can only appeal your own posts'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if post has 3+ reports (is actually removed)
            report_count = ContentReport.get_report_count_for_post(post)
            if report_count < 3:
                return Response(
                    {'error': 'This post has not been removed due to reports'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if appeal already exists
            existing_appeal = PostAppeal.objects.filter(post=post).first()
            if existing_appeal:
                return Response(
                    {'error': 'An appeal for this post already exists'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            appeal_text = request.data.get('appeal_text', '')
            if not appeal_text.strip():
                return Response(
                    {'error': 'Appeal text is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create the appeal
            appeal = PostAppeal.objects.create(
                post=post,
                author=request.user,
                appeal_text=appeal_text
            )
            
            # Handle evidence files if provided
            evidence_files = request.FILES.getlist('evidence_files')
            for evidence_file in evidence_files:
                AppealEvidenceFile.objects.create(
                    appeal=appeal,
                    file=evidence_file,
                    original_filename=evidence_file.name,
                    file_type=evidence_file.content_type,
                    file_size=evidence_file.size
                )
            
            serializer = PostAppealSerializer(appeal, context={'request': request})
            return Response({
                'success': True,
                'message': 'Appeal submitted successfully',
                'appeal': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"❌ Error in appeal action: {str(e)}")
            return Response(
                {'error': 'An error occurred while submitting the appeal'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['GET'])
    def appeal_status(self, request, handle=None, pk=None):
        """
        Get appeal status for a post
        """
        try:
            post = get_object_or_404(Post, author__handle=handle, pk=pk)
            
            # Check if user is the post author
            if post.author != request.user:
                return Response(
                    {'error': 'You can only check appeal status for your own posts'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            appeal = PostAppeal.objects.filter(post=post).first()
            if not appeal:
                return Response({
                    'has_appeal': False,
                    'can_appeal': ContentReport.get_report_count_for_post(post) >= 3
                })
            
            serializer = PostAppealSerializer(appeal, context={'request': request})
            return Response({
                'has_appeal': True,
                'appeal': serializer.data
            })
            
        except Exception as e:
            print(f"❌ Error in appeal_status action: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching appeal status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['GET'])
    def my_appeals(self, request):
        """
        Get current user's appeals
        """
        try:
            appeals = PostAppeal.objects.filter(author=request.user).select_related('post', 'post__author').order_by('-created_at')
            
            page = self.paginate_queryset(appeals)
            if page is not None:
                serializer = PostAppealSerializer(page, many=True, context={'request': request})
                return self.get_paginated_response(serializer.data)
            
            serializer = PostAppealSerializer(appeals, many=True, context={'request': request})
            return Response(serializer.data)
            
        except Exception as e:
            print(f"❌ Error in my_appeals action: {str(e)}")
            return Response(
                {'error': 'An error occurred while fetching appeals'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
