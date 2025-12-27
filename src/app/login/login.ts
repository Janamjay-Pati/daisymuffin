import { Component, OnInit } from '@angular/core';
import { SupabaseService } from './../../services/supabase.service';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit(): Promise<void> {
    await this.supabaseService.client.auth.signOut();
  }

  async loginWithGoogle() {
    await this.supabaseService.client.auth.signInWithOAuth({
      provider: 'google'
    });
  }

}
