import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WordColorMap } from './word-color-map';

describe('WordColorMap', () => {
  let component: WordColorMap;
  let fixture: ComponentFixture<WordColorMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordColorMap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WordColorMap);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
