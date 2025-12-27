import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    const user = await this.supabaseService.getSession();

    if (!user) {
        this.router.navigate(['/auth']);
        return false;
    }

    const allowed = await this.supabaseService.isUserAllowed();

    if (!allowed) {
        await this.supabaseService.client.auth.signOut();
        this.router.navigate(['/auth']);
        return false;
    }

    return true;
    }
}