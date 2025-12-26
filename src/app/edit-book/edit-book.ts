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

@Component({
  selector: 'app-edit-book',
  imports: [MatButtonModule, MatDialogModule, MatInputModule, FormsModule, MatFormFieldModule, MatTableModule, MatIconModule, CommonModule, MatTooltipModule],
  templateUrl: './edit-book.html',
  styleUrl: './edit-book.scss',
})
export class EditBook {
    data = inject(MAT_DIALOG_DATA);
    bookImage!: string;
    displayedColumns: string[] = ['chapterName', 'isCompleted', 'actions'];

    constructor(private router: Router, private dialogRef: MatDialogRef<EditBook>, private dataService: DataService) {
      this.bookImage = this.data.book;
    }

    editChapter(element: any) {
      this.dataService.chapterData$.next({
        name: element.name,
        content: element.content
      });
      this.close();
      this.router.navigate(['/editor']);
    }

    onImageSelected(event: Event) {
      const input = event.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;

      const file = input.files[0];

      // Preview immediately
      const reader = new FileReader();
      reader.onload = () => {
        this.bookImage = reader.result as string;
      };
      reader.readAsDataURL(file);

      // 🔥 Later: upload to Firebase / Supabase here
    }

    close() {
      this.dialogRef.close('closed');
    }

}
