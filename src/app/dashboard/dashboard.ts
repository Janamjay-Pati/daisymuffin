import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WordGraphComponent } from './../word-graph/word-graph.component';
import { EditBook } from './../edit-book/edit-book';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormField } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, WordGraphComponent, MatToolbarModule, MatIconModule, MatButtonModule, MatTooltipModule, MatFormField, FormsModule, MatInputModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  constructor(private dialog: MatDialog) {}

  public readonly title = signal('Name');

  newBookName: string = '';

  newBookDescription: string = '';

  newBookImage: string = 'assets/Upload.png';

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

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      this.newBookImage = reader.result as string;
    };
    reader.readAsDataURL(file);

    // 🔥 Later: upload to Firebase / Supabase here
  }

  addNewBook(): void {
    console.log('Adding new book:', this.newBookName, this.newBookDescription, this.newBookImage);
    // Add your logic here to handle the addition of a new book
    // Reset the form fields after adding the book
    this.newBookName = '';
    this.newBookDescription = '';
    this.newBookImage = 'assets/Upload.png';
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

  editTheBook(index: number): void {
    console.log(`Editing the book for slide index: ${index}`);
    // Add your logic here to handle the "Edit The Book" action
    this.dialog.open(EditBook, {
      data: {
        book: this.images[index],
        name: 'Book ' + (index + 1),
        description: 'Description for Book ' + (index + 1),
        chapters: [
          { name: 'Chapter 1', content: 'The fox climbed', isCompleted: true, isArchived: false },
          { name: 'Chapter 2', content: 'The quick brown fox', isCompleted: false, isArchived: false },
          { name: 'Chapter 3', content: 'Jumps over the lazy dog', isCompleted: false, isArchived: true }
        ]
      },
      width: '1000px',
      height: '600px'
    });
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
    { date: '23 Dec 2025', book: 'AURA', words: 1200 },
    { date: '24 Dec 2025', book: 'BTL', words: 4000 },
    { date: '24 Dec 2025', book: 'AURA', words: 0 },
    { date: '25 Dec 2025', book: 'BTL', words: 0 },
    { date: '25 Dec 2025', book: 'AURA', words: 0 },
    { date: '26 Dec 2025', book: 'BTL', words: 2500 },
    { date: '26 Dec 2025', book: 'AURA', words: 3000 },
  ];
}
