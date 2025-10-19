import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { publicGuard } from './guards/public.guard';


export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/pages/landing/landing.component').then(m => m.LandingComponent),
    canActivate: [publicGuard]
  },
  {
    path: 'home',
    loadComponent: () => import('./components/pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'notifications',
    loadComponent: () => import('./components/pages/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'bookmarks',
    loadComponent: () => import('./components/pages/bookmarks/bookmarks.component').then(m => m.BookmarksComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'search',
    loadComponent: () => import('./components/pages/search/search.component').then(m => m.SearchComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'messages',
    loadComponent: () => import('./components/pages/messages/messages.component').then(m => m.MessagesComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'messages/:conversationId',
    loadComponent: () => import('./components/pages/messages/messages.component').then(m => m.MessagesComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'recommended-users',
    loadComponent: () => import('./components/widgets/recommended-users/recommended-users.component').then(m => m.RecommendedUsersComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'appeals',
    loadComponent: () => import('./components/pages/appeals/appeals.component').then(m => m.AppealsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'appeal/:handle/:postId',
    loadComponent: () => import('./components/pages/appeal-submission/appeal-submission.component').then(m => m.AppealSubmissionComponent),
    canActivate: [AuthGuard]
  },
  {
    path: ':handle/post/:id',
    loadComponent: () => import('./components/features/posts/post-detail/post-detail.component').then(m => m.PostDetailComponent),
    canActivate: [AuthGuard]
  },
  {
    path: ':handle/followers',
    loadComponent: () => import('./components/pages/connections/connections.component').then(m => m.ConnectionsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: ':handle/following',
    loadComponent: () => import('./components/pages/connections/connections.component').then(m => m.ConnectionsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: ':handle/connections',
    loadComponent: () => import('./components/pages/connections/connections.component').then(m => m.ConnectionsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: ':handle',
    loadComponent: () => import('./components/pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];
