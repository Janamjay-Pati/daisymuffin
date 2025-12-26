import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Chapter {
  name: string;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  chapterData$ = new BehaviorSubject<Chapter | null>(null);
}