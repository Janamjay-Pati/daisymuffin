import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Dashboard } from './dashboard/dashboard';
import { Editor } from './editor/editor';
import { AuthGuard } from '../guards/auth.guard';

export const routes: Routes = [
  // Public login route
  {
    path: 'auth',
    component: Login
  },

  // Protected dashboard (default landing)
  {
    path: '',
    component: Dashboard,
    canActivate: [AuthGuard]
  },

  // Protected editor
  {
    path: 'editor',
    component: Editor,
    canActivate: [AuthGuard]
  },

  // Fallback
  {
    path: '**',
    redirectTo: 'auth'
  }
];