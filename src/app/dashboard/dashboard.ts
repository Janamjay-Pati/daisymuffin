import { Component, ChangeDetectorRef, signal } from '@angular/core';
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
  constructor(private dialog: MatDialog, private supabaseService: SupabaseService, private router: Router, private cdr: ChangeDetectorRef) {}

  badges : any[] = [];

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

  totalWords: number = 0;

  get nextBadge() {
    return this.badges.find(b => this.totalWords < b.threshold);
  }

  get progressPercent() {
    const next = this.nextBadge;
    if (!next) return 100;

    return Math.min(
      (this.totalWords / next.threshold) * 100,
      100
    );
  }

  // New helper to know when every badge is unlocked
  get allBadgesUnlocked() {
    return this.badges.length > 0 && this.badges.every(b => b.unlocked);
  }

  get progressText() {
    // don't show 'All badges unlocked' when badges haven't been loaded
    if (this.badges.length === 0) return '';

    const next = this.nextBadge;
    if (!next) return 'All badges unlocked 👑';

    return `${this.totalWords.toLocaleString()} / ${next.threshold.toLocaleString()} words for "${next.name}" Badge`;
  }

  async fetchTotalWords(): Promise<number> {
    const { data, error } = await this.supabaseService.client
      .from('daily_book_stats')
      .select('total_words');

    if (error) {
      console.error('Error fetching total words', error);
      return 0;
    }

    return data.reduce((sum, row) => sum + row.total_words, 0);
  }

  async ngOnInit(): Promise<void> {
    await this.fetchBookImages();  // fetch images first
    this.start();

    const books = await this.fetchBooks();
    this.writingRows = await this.getWeeklyWritingRows(books);

    this.totalWords = await this.fetchTotalWords();
    await this.fetchBadges();
    this.updateBadgeStatus(this.totalWords);

    // Subscribe to realtime changes
    this.statsSubscription = this.supabaseService.client
      .channel('public:daily_book_stats') // channel name (can be anything)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_book_stats' },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Realtime update:', payload);
          this.refreshGraph(); // Re-fetch latest weekly rows

          // Recalculate total words after refresh
          const totalWords = await this.fetchTotalWords();
          this.totalWords = totalWords;
          await this.fetchBadges();
          this.updateBadgeStatus(totalWords);
        }
      )
      .subscribe();
  }

  async logout() {
    await this.supabaseService.logout();
    this.router.navigate(['/auth']);
  }

  async fetchBadges() {
    const { data, error } = await this.supabaseService.client
      .from('badges')
      .select('*')
      .order('threshold');

    if (error) {
      console.error('Error fetching badges', error);
      return;
    }

    this.badges = data.map(b => ({
      ...b,
      unlocked: false
    }));

    console.log('Fetched badges:', this.badges);
  }

  updateBadgeStatus(totalWords: number) {
    this.badges.forEach(badge => {
      badge.unlocked = totalWords >= badge.threshold;
    });
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
    this.cdr.detectChanges();
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
      this.cdr.detectChanges();
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
    const { data: session } =
      await this.supabaseService.client.auth.getSession();

    if (!session.session) {
      console.error('No active session');
      return;
    }

    const { data: sessionData, error: sessionError } = await this.supabaseService.client.auth.getUser();

    if (sessionError || !sessionData?.user) {
      console.error('No logged-in user');
      return;
    }

    const userId = sessionData.user.id;

    const { data, error } = await this.supabaseService.client
      .from('books')
      .insert([{
        title: this.newBookName,
        description: this.newBookDescription,
        user_id: userId
      }])
      .select()
      .single();

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
    this.current.set(this.images.length - 1); // focus newly added book
    const books = await this.fetchBooks();
    this.writingRows = await this.getWeeklyWritingRows(books);
    this.cdr.detectChanges();
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
          .select('id, name, content, word_count, is_completed, is_archived')
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
            wordCount: ch.word_count,
            isCompleted: ch.is_completed,
            isArchived: ch.is_archived
          }))
        }
      });

      this.dialog.afterAllClosed.subscribe(async () => {
        // Refresh carousel images and graph after dialog is closed
        await this.fetchBookImages();
        const books = await this.fetchBooks();
        this.writingRows = await this.getWeeklyWritingRows(books);
        this.cdr.detectChanges();
      });

    } catch (err) {
      console.error('Unexpected error in editTheBook()', err);
    }
  }

  // example data to feed the graph
  async getWeeklyWritingRows(
    books: { id: string; title: string }[]
  ): Promise<{ date: string; isoDate: string; book: string; words: number }[]> {

    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - 6);

    const { data, error } = await this.supabaseService.client
      .from('daily_book_stats')
      .select('stat_date, total_words, book_id')
      .gte('stat_date', this.formatDateIST(fromDate))
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

    const writingRows: { date: string; isoDate: string; book: string; words: number }[] = [];

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const dateKey = this.formatDateIST(d);
      const displayDate = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      for (const book of books) {
        const key = `${dateKey}_${book.id}`;

        writingRows.push({
          date: displayDate,
          isoDate: dateKey,
          book: book.title,
          words: dbMap.get(key) ?? 0
        });
      }
    }

    writingRows.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    return writingRows;
  }

  formatDateIST(date: Date): string {
      return date.toLocaleDateString('en-CA');
  }
}
