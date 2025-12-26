import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import {Editor} from './editor/editor';

export const routes: Routes = [
    {
        path: '',
        component: Dashboard
    },
    {
        path: 'editor',
        component: Editor
    },
    { path: '**', redirectTo: 'auth' },
];