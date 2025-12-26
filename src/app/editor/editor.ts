import { Component, ViewChild, OnInit, ChangeDetectorRef } from '@angular/core';
import { saveAs } from 'file-saver';
import { FormsModule } from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router, ActivatedRoute } from '@angular/router';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './../../services/firebase.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { WordColorMap } from './../word-color-map/word-color-map';
import { Document, Packer, Paragraph, TextRun, NumberFormat } from 'docx';
import JSZip from 'jszip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ViewEncapsulation } from '@angular/core';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule, QuillEditorComponent],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Editor implements OnInit {
  content = '';
  selectedColor = '#000000';
  isFindAndReplaceActive = false;
  toolbarHidden = false;
  darkMode = false;
  modules = {
    toolbar: {
      container: '#custom-toolbar'
    },
    history: {
      delay: 1000,
      maxStack: 100,
      userOnly: true
    }
  };
  focusMode = false;
  wordCount = 0;
  charCount = 0;
  bookTitle = '';
  chapterName = '';
  chapterDocId: string | null = null;
  bookDocId: string | null = null;
  selectedHighlight: string = '#ffff00'; // Default highlight color (yellow)
  wordColorMap: { [word: string]: string } = {};
  wordColorMapList: { id: string, word: string, color: string }[] = [];
  @ViewChild(QuillEditorComponent) quillEditorComponent!: QuillEditorComponent;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dataService: DataService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    // Listen to changes and update word/char count
    setInterval(() => {
      const text = this.stripHtml(this.content || '');
      this.wordCount = text.trim().split(/\s+/).filter(w => w).length;
      this.charCount = text.length;
    }, 500);

    this.dataService.chapterData$.subscribe(chapter => {
      if (chapter) {
        this.chapterName = chapter.name;
        this.content = chapter.content;
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        this.focusMode = false; // User exited fullscreen (possibly via Escape)
        this.toolbarHidden = false; // Show toolbar again
        this.cdr.detectChanges();
      }
    });

    this.highlightMapping();
  }

  async highlightMapping() {
    this.wordColorMapList = await this.getWordColorMapList();
    await this.highlightMappedWords();
  }

  undo() {
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (quillEditor) {
      quillEditor.history.undo();
    }
  }

  redo() {
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (quillEditor) {
      quillEditor.history.redo();
    }
  }

  onBackArrowClick(focusMode: boolean) {
    if (focusMode) {
      this.toggleFocusMode();
    } else {
      this.router.navigate(['/']);
    }
  }

  toggleFocusMode() {
    this.focusMode = !this.focusMode;
    this.toolbarHidden = this.focusMode;
  
    const el = document.documentElement;
  
    if (this.focusMode) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
      else if ((el as any).msRequestFullscreen) (el as any).msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      else if ((document as any).msExitFullscreen) (document as any).msExitFullscreen();
    }
  }

  toggleFindAndReplace() {
    this.isFindAndReplaceActive = !this.isFindAndReplaceActive;
  }

  openOptions() {
    this.toolbarHidden = !this.toolbarHidden;
  }

  stripHtml(html: string) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  applyColor(event: any) {
    const color = event.target.value;
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (quillEditor) {
      const range = quillEditor.getSelection();
      if (range && range.length > 0) {
        quillEditor.format('color', color, 'user');
      } else {
        // Set color for future input
        quillEditor.format('color', color, 'user');
      }
    }
  }

  async save() {
    if (this.bookDocId && this.chapterDocId) {
      const chapterRef = doc(db, 'Books', this.bookDocId, 'chapters', this.chapterDocId);
      await updateDoc(chapterRef, { content: this.content });
      this.snackBar.open('Chapter saved successfully!', 'Dismiss', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    } else {
      this.snackBar.open('Error saving chapter. Please try again.', 'Dismiss', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  applyHighlight(event: any) {
    const color = event.target.value;
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (quillEditor) {
      const range = quillEditor.getSelection();
      if (range && range.length > 0) {
        quillEditor.format('background', color);
      } else {
        // Set background for future input
        quillEditor.format('background', color);
      }
    }
  }

  private isHighlighting = false;

  async onContentChanged() {
    if (this.isHighlighting) return;
    this.wordColorMapList = await this.getWordColorMapList();
    await this.highlightMappedWords();
  }

  highlightMappedWords() {
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (!quillEditor) return;

    this.isHighlighting = true;

    const text = quillEditor.getText();
    const delta = quillEditor.getContents();
    let index = 0;

    // Remove previous highlights
    quillEditor.formatText(0, text.length, { background: false });

    Object.entries(this.wordColorMap).forEach(([word, color]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        // Only highlight if the match is a whole word
        quillEditor.formatText(match.index, word.length, { background: color });
      }
    });

    this.isHighlighting = false;
  }

  async addWordMapping() {
    // Fetch the latest mapping list before opening the dialog
    const latestWordColorMapList = await this.getWordColorMapList();
    this.dialog.open(WordColorMap, {
      width: '500px',
      data: { bookDocId: this.bookDocId, wordColorMapList: latestWordColorMapList }
    }).afterClosed().subscribe(async (result) => {
      if (result) {
        // Update the wordColorMap with the new mapping
        this.wordColorMap[result.word] = result.color;
        // Reapply highlights
        await this.highlightMapping();
        console.log('Word mapping added:', this.wordColorMap);
      }
    });
  }

  async getWordColorMapList() {
    if (!this.bookDocId) return [];
    const wordMapSnapshot = await getDocs(collection(db, 'Books', this.bookDocId, 'WordMap'));
    const wordColorMapList: { id: string, word: string, color: string }[] = [];
    wordMapSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      wordColorMapList.push({ id: docSnap.id, word: data['word'], color: data['color'] });
    });
    this.wordColorMap = wordColorMapList.reduce((acc, item) => {
      acc[item.word] = item.color;
      return acc;
    }, {} as { [word: string]: string });
    return wordColorMapList;
  }

  async exportToGoogleDocs() {
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (!quillEditor) {
      console.error('Quill editor not found');
      return;
    }

    const delta = quillEditor.getContents();
    const paragraphs: Paragraph[] = [];

    // Helper to create TextRuns for a given text segment with attributes
    function createTextRun(text: string, attrs: any): TextRun {
      return new TextRun({
        text: text,
        // bold: !!attrs['bold'],
        // italics: !!attrs['italic'],
        // underline: attrs['underline'] ? { type: UnderlineType.SINGLE } : undefined,
        // strike: !!attrs['strike'],
        // color: typeof attrs['color'] === 'string' ? attrs['color'] : undefined,
        // shading: typeof attrs['background'] === 'string'
        //   ? { type: 'clear', fill: attrs['background'] }
        //   : undefined,
      });
    }

    // We'll collect lines grouped by their list type and level, so consecutive list items stay in same numbering
    let currentListType: string | null = null;
    let currentListLevel = 0;
    let currentParagraphRuns: TextRun[] = [];

    function pushParagraph() {
      if (currentParagraphRuns.length === 0) return;
      let paragraphOptions: any = { children: currentParagraphRuns };
      if (currentListType === 'ordered') {
        paragraphOptions.numbering = {
          reference: 'my-numbering',
          level: currentListLevel,
        };
      } else if (currentListType === 'bullet') {
        paragraphOptions.bullet = {
          level: currentListLevel,
        };
      }
      paragraphs.push(new Paragraph(paragraphOptions));
      currentParagraphRuns = [];
    }

    for (let i = 0; i < delta.ops.length; i++) {
      const op = delta.ops[i];
      if (typeof op.insert !== 'string') continue;

      const attrs = op.attributes || {};
      const text = op.insert;

      // Split by newlines, but keep newlines as separate segments to handle them correctly
      const segments = text.split(/(\n)/);

      for (let j = 0; j < segments.length; j++) {
        const segment = segments[j];
        if (segment === '\n') {
          // Newline indicates end of paragraph or list item
          pushParagraph();
          currentListType = null;
          currentListLevel = 0;
          continue;
        }

        if (segment.length === 0) continue;

        // Check if this segment has list attribute to set current list context
        if (attrs['list']) {
          // If list type changes from previous, push previous paragraph first
          if (attrs['list'] !== currentListType) {
            pushParagraph();
            currentListType = attrs['list'] as string;
            currentListLevel = 0;
          }
        } else {
          // No list attribute, if previously in a list, push paragraph and reset
          if (currentListType !== null) {
            pushParagraph();
            currentListType = null;
            currentListLevel = 0;
          }
        }

        // Create TextRun for this segment and add to current paragraph runs
        currentParagraphRuns.push(createTextRun(segment, attrs));
      }
    }

    // Push any remaining paragraph runs
    pushParagraph();

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'my-numbering',
            levels: [
              {
                level: 0,
                format: NumberFormat.DECIMAL,
                text: '%1.',
                alignment: 'start',
              },
            ],
          },
        ],
      },
      sections: [{ children: paragraphs }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${this.chapterName || 'chapter'}.docx`);
  }

  async exportToEPUB() {
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (!quillEditor) return;

    // Convert Quill HTML to valid XHTML
    const htmlContent = this.toValidXhtml(quillEditor.root.innerHTML);
    const title = this.chapterName || 'Chapter';
    const author = this.bookTitle || '';

    const zip = new JSZip();

    // mimetype (uncompressed)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // container.xml
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`);

    // content.opf
    zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <metadata>
          <dc:identifier id="bookid">urn:uuid:${crypto.randomUUID()}</dc:identifier>
          <dc:title>${title}</dc:title>
          <dc:creator>${author}</dc:creator>
          <dc:language>en</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="nav"/>
          <itemref idref="chapter1"/>
        </spine>
      </package>`);

    // nav.xhtml
    zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE html>
  <html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:epub="http://www.idpf.org/2007/ops"
      lang="en"
      xml:lang="en">
    <head>
      <title>Table of Contents</title>
      <meta charset="UTF-8"/>
    </head>
    <body>
      <nav epub:type="toc" id="toc">
        <h1>Table of Contents</h1>
        <ol>
          <li><a href="chapter1.xhtml">${title}</a></li>
        </ol>
      </nav>
    </body>
  </html>`);

    // chapter1.xhtml (with fixed HTML)
    zip.file('OEBPS/chapter1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE html>
  <html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
    <head>
      <title>${title}</title>
      <meta charset="UTF-8"/>
    </head>
    <body>${htmlContent}</body>
  </html>`);

    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${title}.epub`);
  }

  toValidXhtml(html: string): string {
    return html
      .replace(/<br>/g, '<br />')
      .replace(/<hr>/g, '<hr />')
      .replace(/<img(.*?)>/g, '<img$1 />');
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    if (this.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  findText(searchTerm: string): number[] {
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (!quillEditor || !searchTerm) return [];
    const text = quillEditor.getText();

    // Treat the search term as a case-insensitive pattern
    const regex = new RegExp(searchTerm, 'gi');
    let match;
    const indexes: number[] = [];

    // Apply highlight using the 'user' source so the history module will record it
    while ((match = regex.exec(text)) !== null) {
      indexes.push(match.index);
      quillEditor.formatText(match.index, match[0].length, { background: '#ffeb3b' }, 'user');
    }

    return indexes;
  }

  replaceText(searchTerm: string, replaceTerm: string) {
    const quillEditor = this.quillEditorComponent?.quillEditor;
    if (!quillEditor || !searchTerm) return;

    const text = quillEditor.getText();
    const regex = new RegExp(searchTerm, 'gi');
    let match;
    const matches: { index: number, length: number }[] = [];

    // Collect all matches first (so indices remain stable), then replace from end -> start
    while ((match = regex.exec(text)) !== null) {
      matches.push({ index: match.index, length: match[0].length });
    }

    // Replace in reverse order to avoid shifting indexes for subsequent replacements
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      // Use the 'user' source so the history module picks up the deletion and insertion (undo/redo works)
      quillEditor.deleteText(m.index, m.length, 'user');
      if (replaceTerm !== undefined && replaceTerm !== null) {
        // insertText signature: (index, text, formats?, source?) -> provide empty formats object then source
        quillEditor.insertText(m.index, replaceTerm, {}, 'user');
      }
    }
  }

}
