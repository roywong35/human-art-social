import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ProfileComponent } from './components/profile/profile.component';
import { BookmarksComponent } from './components/bookmarks/bookmarks.component';
import { PostDetailComponent } from './components/post-detail/post-detail.component';
import { AuthGuard } from './guards/auth.guard';

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
    path: '**',
    redirectTo: '/'
  }
];
