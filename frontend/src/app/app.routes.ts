import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ProfileComponent } from './components/profile/profile.component';
import { BookmarksComponent } from './components/bookmarks/bookmarks.component';
import { PostDetailComponent } from './components/post-detail/post-detail.component';
import { SearchComponent } from './components/search/search.component';
import { ConnectionsComponent } from './components/connections/connections.component';
import { AuthGuard } from './guards/auth.guard';
import { RecommendedUsersComponent } from './components/recommended-users/recommended-users.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'home',
    redirectTo: '/',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
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
    path: 'recommended-users',
    component: RecommendedUsersComponent,
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
    path: '**',
    redirectTo: '/'
  }
];
