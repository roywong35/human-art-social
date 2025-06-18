import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { Router } from '@angular/router';

// Extend the User type to include our UI states
interface UserWithState extends User {
  isFollowLoading?: boolean;
  isHoveringFollowButton?: boolean;
}

@Component({
  selector: 'app-recommended-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recommended-users.component.html',
  styleUrls: ['./recommended-users.component.scss']
})
export class RecommendedUsersComponent implements OnInit {
  users: UserWithState[] = [];
  isLoading = false;

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('RecommendedUsersComponent initialized');
    this.loadUsers();
  }

  loadUsers() {
    console.log('RecommendedUsersComponent: Loading users...');
    this.isLoading = true;
    this.userService.getRecommendedUsers().subscribe({
      next: (users: User[]) => {
        console.log('RecommendedUsersComponent: Users loaded successfully:', users);
        this.users = users.map(user => ({
          ...user,
          isFollowLoading: false,
          isHoveringFollowButton: false
        }));
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('RecommendedUsersComponent: Error loading users:', error);
        this.isLoading = false;
      }
    });
  }

  followUser(user: UserWithState, event: Event) {
    event.stopPropagation();
    if (user.isFollowLoading) return;

    user.isFollowLoading = true;
    this.userService.followUser(user.handle).subscribe({
      next: (updatedUser) => {
        const index = this.users.findIndex(u => u.handle === user.handle);
        if (index !== -1) {
          this.users[index] = {
            ...updatedUser,
            isFollowLoading: false,
            isHoveringFollowButton: false
          };
        }
      },
      error: (error: unknown) => {
        console.error('Error following user:', error);
        user.isFollowLoading = false;
      }
    });
  }

  onFollowButtonHover(user: UserWithState, isHovering: boolean) {
    user.isHoveringFollowButton = isHovering;
  }

  navigateToProfile(handle: string) {
    this.router.navigate(['/', handle]);
  }
} 