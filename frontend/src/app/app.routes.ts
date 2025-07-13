import { Routes } from '@angular/router';
import { HomeComponent } from './components/pages/home/home.component';
import { ProfileComponent } from './components/pages/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';
import { publicGuard } from './guards/public.guard';
import { LandingComponent } from './components/pages/landing/landing.component';
import { NotificationsComponent } from './components/pages/notifications/notifications.component';
import { SearchComponent } from './components/pages/search/search.component';
import { PostDetailComponent } from './components/features/posts/post-detail/post-detail.component';
import { BookmarksComponent } from './components/pages/bookmarks/bookmarks.component';
import { ConnectionsComponent } from './components/pages/connections/connections.component';
import { RecommendedUsersComponent } from './components/widgets/recommended-users/recommended-users.component';
import { MessagesComponent } from './components/pages/messages/messages.component';
import { AppealSubmissionComponent } from './components/pages/appeal-submission/appeal-submission.component';
import { AppealsComponent } from './components/pages/appeals/appeals.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent,
    canActivate: [publicGuard]
  },
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'notifications',
    component: NotificationsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'bookmarks',
    component: BookmarksComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'search',
    component: SearchComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'messages',
    component: MessagesComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'messages/:conversationId',
    component: MessagesComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'recommended-users',
    component: RecommendedUsersComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'appeals',
    component: AppealsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'appeal/:handle/:postId',
    component: AppealSubmissionComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':handle/post/:id',
    component: PostDetailComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':handle/followers',
    component: ConnectionsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':handle/following',
    component: ConnectionsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':handle/connections',
    component: ConnectionsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':handle',
    component: ProfileComponent,
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/'
  }
];
