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
import {Router} from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { SupabaseService } from '../../services/supabase.service';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type DailyBookStatRow = {
  stat_date: string;
  total_words: number;
  book_id: string;
  books: {
    title: string;
  }[];
};

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, WordGraphComponent, MatToolbarModule, MatIconModule, MatButtonModule, MatTooltipModule, MatFormField, FormsModule, MatInputModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  constructor(private dialog: MatDialog, private supabaseService: SupabaseService, private router: Router) {}

  writingRows: any[] = [];

  public readonly title = signal('Name');

  newBookName: string = '';

  newBookDescription: string = '';

  newBookImage: string = 'assets/Upload.png';

  // Images used by the carousel (update paths as needed)
  public images: string[] = [];

  // current index as a signal
  public readonly current = signal(0);

  private intervalId: number | undefined;

  private statsSubscription: any;

  private readonly intervalMs = 3000; // rotate every 3s

  async ngOnInit(): Promise<void> {
    await this.fetchBookImages();  // fetch images first
    this.start();

    const books = await this.fetchBooks();
    this.writingRows = await this.getWeeklyWritingRows(books);

    // Subscribe to realtime changes
    this.statsSubscription = this.supabaseService.client
      .channel('public:daily_book_stats') // channel name (can be anything)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_book_stats' },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Realtime update:', payload);
          this.refreshGraph(); // Re-fetch latest weekly rows
        }
      )
      .subscribe();
  }

  async logout() {
    await this.supabaseService.logout();
    this.router.navigate(['/auth']);
  }

  async fetchBookImages(): Promise<void> {
    const { data, error } = await this.supabaseService.client
      .from('books')
      .select('cover_image');

    if (error) {
      console.error('Error fetching book images:', error);
      return;
    }

    this.images = data?.map(book => book.cover_image || 'assets/Upload.png') || [];
  }
  
  async refreshGraph() {
    const books = await this.fetchBooks();
    this.writingRows = await this.getWeeklyWritingRows(books);
  }

  ngOnDestroy() {
    this.stop();

    // Remove specific subscription if present
    if (this.statsSubscription) {
      this.supabaseService.client.removeChannel(this.statsSubscription);
    }

    // Safety: remove ANY leftover realtime channels
    this.supabaseService.client.removeAllChannels();
  }

  async fetchBooks(): Promise<{ id: string; title: string }[]> {
    const { data, error } = await this.supabaseService.client
      .from('books')
      .select('id, title');

    if (error) {
      console.error('Error fetching books:', error);
      return [];
    }

    return data ?? [];
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Preview the image locally
    const reader = new FileReader();
    reader.onload = () => {
      this.newBookImage = reader.result as string;
    };
    reader.readAsDataURL(file);

    // Store the file temporarily for upload when adding the book
    (this as any)._pendingCoverFile = file;
  }

async addNewBook(): Promise<void> {
  if (!this.newBookName.trim()) {
    console.error('Book name is required');
    return;
  }

  try {
    // 1️⃣ Insert book
    const { data, error } = await this.supabaseService.client
      .from('books')
      .insert([{
        title: this.newBookName,
        description: this.newBookDescription
      }])
      .select()
      .single(); // return the inserted row

    if (error || !data) {
      console.error('Error adding new book:', error);
      return;
    }

    const bookId = data.id;

    // 2️⃣ Upload cover image if a file was selected
    const pendingFile: File | undefined = (this as any)._pendingCoverFile;
    if (pendingFile) {
      const uploadPath = `book-${bookId}.png`;

      const { error: uploadError } = await this.supabaseService.client.storage
        .from('book-covers')
        .upload(uploadPath, pendingFile, { upsert: true });

      if (!uploadError) {
        const { data: urlData } = this.supabaseService.client.storage
          .from('book-covers')
          .getPublicUrl(uploadPath);

        await this.supabaseService.client
          .from('books')
          .update({ cover_image: urlData.publicUrl })
          .eq('id', bookId);
      }

      delete (this as any)._pendingCoverFile;
    }

    // 3️⃣ Reset form fields
    this.newBookName = '';
    this.newBookDescription = '';
    this.newBookImage = 'assets/Upload.png';

    // 4️⃣ Refresh carousel images and graph
    await this.fetchBookImages();
    const books = await this.fetchBooks();
    this.writingRows = await this.getWeeklyWritingRows(books);

  } catch (e) {
    console.error('Error in addNewBook:', e);
  }
}

  private start(): void {
    if (this.intervalId != null) return;
    if (this.images.length === 0) return; // 👈 IMPORTANT

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
    if (this.images.length === 0) return;
    this.current.update(i => (i - 1 + this.images.length) % this.images.length);
  }

  public next(): void {
    if (this.images.length === 0) return;
    this.current.update(i => (i + 1) % this.images.length);
  }

  async editTheBook(index: number): Promise<void> {
    try {
      // 1️⃣ Get books in the same order as carousel
      const { data: books, error: bookError } =
        await this.supabaseService.client
          .from('books')
          .select('id, title, description, cover_image')
          .order('created_at');

      if (bookError || !books || !books[index]) {
        console.error('Failed to fetch selected book', bookError);
        return;
      }

      const book = books[index];

      // 2️⃣ Fetch chapters for this book
      const { data: chapters, error: chapterError } =
        await this.supabaseService.client
          .from('chapters')
          .select('id, name, content, is_completed, is_archived')
          .eq('book_id', book.id)
          .order('created_at');

      if (chapterError) {
        console.error('Failed to fetch chapters', chapterError);
        return;
      }

      // 3️⃣ Open dialog with Supabase-backed data
      this.dialog.open(EditBook, {
        width: '1000px',
        height: '600px',
        data: {
          bookId: book.id,
          coverImage: book.cover_image,
          name: book.title,
          description: book.description,
          chapters: (chapters ?? []).map(ch => ({
            id: ch.id,
            name: ch.name,
            content: ch.content,
            isCompleted: ch.is_completed,
            isArchived: ch.is_archived
          }))
        }
      });

    } catch (err) {
      console.error('Unexpected error in editTheBook()', err);
    }
  }

  // example data to feed the graph
  async getWeeklyWritingRows(
    books: { id: string; title: string }[]
  ): Promise<{ date: string; book: string; words: number }[]> {

    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - 6);

    const { data, error } = await this.supabaseService.client
      .from('daily_book_stats')
      .select('stat_date, total_words, book_id')
      .gte('stat_date', fromDate.toISOString().split('T')[0])
      .order('stat_date');

    if (error) {
      console.error('Error fetching daily stats:', error);
      return [];
    }

    const dbMap = new Map<string, number>();

    (data as DailyBookStatRow[] | null)?.forEach(row => {
      const key = `${row.stat_date}_${row.book_id}`;
      dbMap.set(key, row.total_words);
    });

    const writingRows: { date: string; book: string; words: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      const dateKey = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      for (const book of books) {
        const key = `${dateKey}_${book.id}`;

        writingRows.push({
          date: displayDate,
          book: book.title,
          words: dbMap.get(key) ?? 0
        });
      }
    }

    return writingRows;
  }
}
