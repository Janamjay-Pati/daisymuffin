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

@Component({
  selector: 'app-edit-book',
  imports: [MatButtonModule, MatDialogModule, MatInputModule, FormsModule, MatFormFieldModule, MatTableModule, MatIconModule, CommonModule, MatTooltipModule],
  templateUrl: './edit-book.html',
  styleUrl: './edit-book.scss',
})
export class EditBook {
    data = inject(MAT_DIALOG_DATA);
    displayedColumns: string[] = ['chapterName', 'isCompleted', 'actions'];

    constructor(private dialogRef: MatDialogRef<EditBook>) {}

    close() {
      this.dialogRef.close('closed');
    }

}
