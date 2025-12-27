import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import {MatTableModule} from '@angular/material/table';
import {MatIconModule} from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Router} from '@angular/router';
import { DataService } from '../../services/data.service';
import { ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';

interface Chapter {
  id: string;
  name: string;
  content: string;
  wordCount: number;
  isCompleted: boolean;
  isArchived: boolean;
}

@Component({
  selector: 'app-edit-book',
  imports: [MatButtonModule, MatDialogModule, MatInputModule, FormsModule, MatFormFieldModule, MatTableModule, MatIconModule, CommonModule, MatTooltipModule],
  templateUrl: './edit-book.html',
  styleUrl: './edit-book.scss',
})
export class EditBook {
    data = inject(MAT_DIALOG_DATA);
    bookImage!: string;
    newChapterName: string = '';
    displayedColumns: string[] = ['chapterName', 'isCompleted', 'actions'];
    datasource: Chapter[] = [];

    constructor(private router: Router, private dialogRef: MatDialogRef<EditBook>, private dataService: DataService, private cdr: ChangeDetectorRef, private supabaseService: SupabaseService) {
      this.datasource = this.data.chapters.map((row: any) => ({
        id: row.id,
        name: row.name,
        content: row.content,
        wordCount: row.word_count,
        isCompleted: row.is_completed,
        isArchived: row.is_archived
      }));
      this.bookImage = this.data.book;
    }

    async addNewChapter() {
      if (!this.newChapterName.trim()) return;

      const bookId = this.data.bookId;

      const { data, error } = await this.supabaseService.client
        .from('chapters')
        .insert([{
          book_id: bookId,
          name: this.newChapterName,
          content: '',
          word_count: 0,
          is_completed: false,
          is_archived: false
        }])
        .select()
        .single();

      if (error || !data) {
        console.error('Error adding chapter:', error);
        return;
      }

      this.datasource = [
        ...this.datasource,
        {
          id: data.id,
          name: data.name,
          content: data.content,
          wordCount: data.word_count,
          isCompleted: data.is_completed,
          isArchived: data.is_archived
        }
      ];

      this.newChapterName = '';
      this.cdr.detectChanges();
    }

    editChapter(chapter: any) {
      const bookId = this.data.bookId;
      this.router.navigate(['/editor'], { queryParams: { bookId, chapterId: chapter.id } });
      this.close();
    }

    async onImageSelected(event: Event) {
      const input = event.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;

      const file = input.files[0];

      // Preview immediately
      const reader = new FileReader();
      reader.onload = () => {
        this.bookImage = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);

      const bookId = this.data.bookId;
      if (!bookId) return;

      try {
        // Upload to Supabase storage
        const { error: uploadError } = await this.supabaseService.client.storage
          .from('book-covers')
          .upload(`book-${bookId}.png`, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          return;
        }

        // Get public URL
        const { data } = this.supabaseService.client.storage
          .from('book-covers')
          .getPublicUrl(`book-${bookId}.png`);

        if (!data?.publicUrl) {
          console.error('Error getting public URL');
          return;
        }

        const publicUrl = data.publicUrl;
        this.bookImage = publicUrl;

        // **Update the book record in Supabase**
        const { error: updateError } = await this.supabaseService.client
          .from('books')
          .update({ cover_image: publicUrl })
          .eq('id', bookId);

        if (updateError) {
          console.error('Error updating book cover_image:', updateError);
        }
      } catch (e) {
        console.error('Error handling image upload:', e);
      }
    }

    async updateBookName() {
      const bookId = this.data.bookId;
      const newName = this.data.book; // take current ngModel value
      if (!bookId || !newName.trim()) return;

      const { error } = await this.supabaseService.client
        .from('books')
        .update({ title: newName })
        .eq('id', bookId);

      if (error) {
        console.error('Error updating book name:', error);
      } else {
        console.log('Book name updated successfully');
      }
    }

    async updateBookDescription() {
      const bookId = this.data.bookId;
      const newDescription = this.data.description; // use ngModel value
      if (!bookId) return;

      const { error } = await this.supabaseService.client
        .from('books')
        .update({ description: newDescription })
        .eq('id', bookId);

      if (error) {
        console.error('Error updating book description:', error);
      } else {
        console.log('Book description updated successfully');
      }
    }

    async toggleChapterCompletion(chapter: any) {
      const newStatus = !chapter.isCompleted;

      const { error } = await this.supabaseService.client
        .from('chapters')
        .update({ is_completed: newStatus })
        .eq('id', chapter.id);

      if (error) {
        console.error('Error updating chapter completion:', error);
      } else {
        chapter.isCompleted = newStatus; // Update local UI immediately
      }
    }

    async toggleChapterArchive(chapter: any) {
      const newStatus = !chapter.isArchived;

      const { error } = await this.supabaseService.client
        .from('chapters')
        .update({ is_archived: newStatus })
        .eq('id', chapter.id);

      if (error) {
        console.error('Error updating chapter archive status:', error);
        return;
      }

      // Update UI immediately
      chapter.isArchived = newStatus;
    }

    close() {
      this.dialogRef.close();
    }

}
