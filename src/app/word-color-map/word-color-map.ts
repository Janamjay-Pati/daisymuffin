import { Component, ViewChild, ElementRef, Inject, Optional } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormField } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './../../services/firebase.service';

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
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any // <-- Inject dialog data
  ) {}

  openColorPicker() {
    this.colorInput.nativeElement.click();
  }

  async save() {
    if (this.word.trim()) {
      const wordColorMap = { word: this.word.trim(), color: this.selectedColor };
      try {
        // Get bookDocId from dialog data
        const bookDocId = this.data?.bookDocId;
        if (!bookDocId) throw new Error('Book ID not provided');
        // Save to subcollection WordMap under the book
        const docRef = await addDoc(collection(db, 'Books', bookDocId, 'WordMap'), wordColorMap);
        console.log('Document written with ID: ', docRef.id);
        this.dialogRef.close(wordColorMap);
      } catch (e) {
        console.error('Error adding document: ', e);
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
      const bookDocId = this.data?.bookDocId;
      if (!bookDocId) throw new Error('Book ID not provided');
      if (!map.id) throw new Error('Mapping document ID not provided');
      const mapDocRef = doc(db, 'Books', bookDocId, 'WordMap', map.id);
      await updateDoc(mapDocRef, { color: map.color });
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
