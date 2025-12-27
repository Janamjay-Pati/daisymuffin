import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { SupabaseService } from './../services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  user: any;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() {
    // Listen for login/logout events
    this.supabaseService.onAuthChange(user => {
      this.user = user;
    });

    // Restore session on page reload
    this.supabaseService.getSession().then(user => this.user = user);
  }
}
