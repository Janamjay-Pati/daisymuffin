import { Component, Input, OnChanges, SimpleChanges, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';

type RawEntry = { date: string; book: string; words: number };

@Component({
  selector: 'word-graph',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './word-graph.component.html',
  styleUrls: ['./word-graph.component.scss']
})
export class WordGraphComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() raw: RawEntry[] = [];
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['raw'] && this.chart) {
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private createChart(): void {
    // ensure chart text is black by default
    (Chart.defaults as any).color = '#000';

    const { labels, datasets } = this.buildData();

    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { color: '#000' } },
          tooltip: { titleColor: '#000', bodyColor: '#000' }
        },
        scales: {
          x: { title: { display: true, text: 'Date', color: '#000' }, ticks: { color: '#000' } },
          y: { beginAtZero: true, title: { display: true, text: 'Words', color: '#000' }, ticks: { color: '#000' } }
        }
      }
    });
  }

  private updateChart(): void {
    if (!this.chart) return;
    const { labels, datasets } = this.buildData();
    this.chart.data.labels = labels as any;
    this.chart.data.datasets = datasets as any;
    this.chart.update();
  }

  private buildData() {
    const dates = Array.from(new Set(this.raw.map(r => r.date))).sort();
    const books = Array.from(new Set(this.raw.map(r => r.book)));

    const byBook = new Map<string, number[]>();
    books.forEach(b => byBook.set(b, dates.map(() => 0)));

    this.raw.forEach(r => {
      const i = dates.indexOf(r.date);
      if (i >= 0) byBook.get(r.book)![i] += r.words;
    });

    const datasets = books.map((book, idx) => ({
      label: book,
      data: byBook.get(book)!,
      fill: false,
      tension: 0.25,
      borderWidth: 2,
      borderColor: this.pickColor(idx),
      pointRadius: 4
    }));

    return { labels: dates, datasets };
  }

  private pickColor(i: number) {
    const palette = ['#3366CC', '#DC3912', '#FF9900', '#109618', '#990099', '#3B3EAC', '#0099C6', '#DD4477'];
    return palette[i % palette.length];
  }
}
