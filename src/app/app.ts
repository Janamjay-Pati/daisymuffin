import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WordGraphComponent } from './word-graph.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, WordGraphComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit, OnDestroy {
  public readonly title = signal('Name');

  // Images used by the carousel (update paths as needed)
  public readonly images = ['assets/Pic1.jpeg', 'assets/Pic2.jpeg', 'assets/Pic3.jpeg', 'assets/Pic4.jpeg', 'assets/Pic5.jpeg'];

  // current index as a signal
  public readonly current = signal(0);

  private intervalId: number | undefined;
  private readonly intervalMs = 3000; // rotate every 3s

  ngOnInit(): void {
    this.start();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private start(): void {
    if (this.intervalId != null) return;
    this.intervalId = window.setInterval(() => {
      this.current.update(i => (i + 1) % this.images.length);
    }, this.intervalMs);
  }

  private stop(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  // public controls used from the template
  public pause(): void { 
    this.stop();
  }

  public resume(): void { 
    this.start();
  }

  public goTo(i: number): void { 
    this.current.set(i);
  }
  public prev(): void { 
    this.current.update(i => (i - 1 + this.images.length) % this.images.length);
  }
  public next(): void { 
    this.current.update(i => (i + 1) % this.images.length);
  }

  // example data to feed the graph
  public readonly writingRows = [
    { date: '20 Dec 2025', book: 'BTL', words: 0 },
    { date: '20 Dec 2025', book: 'AURA', words: 0 },
    { date: '21 Dec 2025', book: 'BTL', words: 0 },
    { date: '21 Dec 2025', book: 'AURA', words: 800 },
    { date: '22 Dec 2025', book: 'BTL', words: 1500 },
    { date: '22 Dec 2025', book: 'AURA', words: 4700 },
    { date: '23 Dec 2025', book: 'BTL', words: 2000 },
    { date: '23 Dec 2025', book: 'AURA', words: 1200 }
  ];
}
