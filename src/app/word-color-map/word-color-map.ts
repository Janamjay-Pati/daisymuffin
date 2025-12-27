import { Component, ViewChild, ElementRef, Inject, Optional } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormField } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-word-color-map',
  imports: [MatDialogModule, CommonModule, MatButtonModule, MatFormField, FormsModule, MatInputModule, MatIconModule],
  templateUrl: './word-color-map.html',
  styleUrl: './word-color-map.scss',
})
export class WordColorMap {
  word = '';
  selectedColor = '#000000'; // Default color

  @ViewChild('colorInput') colorInput!: ElementRef<HTMLInputElement>;

  constructor(
    private dialogRef: MatDialogRef<WordColorMap>,
    private snackBar: MatSnackBar,
    private supabaseService: SupabaseService,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any // <-- Inject dialog data
  ) {}

  openColorPicker() {
    this.colorInput.nativeElement.click();
  }

  async save() {
    if (this.word.trim()) {
      const wordColorMap = { word: this.word.trim(), color: this.selectedColor };
      try {
        const bookId = this.data?.bookId; // Supabase ID
        if (!bookId) throw new Error('Book ID not provided');

        const { data: existing } = await this.supabaseService.client
          .from('word_color_map')
          .select('id')
          .eq('book_id', bookId)
          .eq('word', this.word.trim())
          .single();

        if (existing) {
          this.snackBar.open('Word already exists', 'Dismiss', { duration: 3000 });
          return;
        }

        const { data, error } = await this.supabaseService.client
          .from('word_color_map')
          .insert([
            {
              book_id: bookId,
              word: this.word.trim(),
              color: this.selectedColor
            }
          ])
          .select()
          .single();

        if (error) throw error;

        // ✅ Close dialog with FULL row (includes id)
        this.dialogRef.close(data);
      } catch (e) {
        console.error('Error adding mapping: ', e);
        this.snackBar.open('Error saving data', 'Dismiss', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    } else {
      this.snackBar.open('Word cannot be empty', 'Dismiss', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  async updateMappingColor(map: any) {
    try {
      const bookId = this.data?.bookId;
      if (!bookId) throw new Error('Book ID not provided');
      if (!map.id) throw new Error('Mapping ID not provided');

      const { error } = await this.supabaseService.client
        .from('word_color_map')
        .update({ color: map.color })
        .eq('id', map.id)
        .eq('book_id', bookId);

      if (error) throw error;
    } catch (e) {
      console.error('Error updating color:', e);
      this.snackBar.open('Error updating color', 'Dismiss', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  cancel() {
    this.dialogRef.close();
  }
}
