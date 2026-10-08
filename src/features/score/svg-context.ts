import type {
  DrawingContext2D,
  TextMetricsLike,
  TransformLike,
} from '@sudobility/music_drawing';

type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};
type State = {
  matrix: Matrix;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  font: string;
  globalAlpha: number;
  lineDash: number[];
};

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function state(): State {
  return {
    matrix: { ...IDENTITY },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '10px sans-serif',
    globalAlpha: 1,
    lineDash: [],
  };
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function number(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '0';
}

function matrixValue(matrix: Matrix): string {
  return `matrix(${number(matrix.a)} ${number(matrix.b)} ${number(
    matrix.c,
  )} ${number(matrix.d)} ${number(matrix.e)} ${number(matrix.f)})`;
}

function colour(value: string | object): string {
  return typeof value === 'string' ? value : '#000000';
}

function fontParts(font: string): {
  size: number;
  family: string;
  weight: string;
} {
  const match = font.match(/(?:^|\s)(\d+(?:\.\d+)?)px\s+(.+)$/);
  if (!match) return { size: 10, family: 'sans-serif', weight: 'normal' };
  const weight = /\bbold\b|\b[6-9]00\b/.test(font) ? '700' : '400';
  return { size: Number(match[1]), family: match[2], weight };
}

function pathArc(
  x: number,
  y: number,
  radius: number,
  start: number,
  end: number,
  counterclockwise: boolean,
  current: { x: number; y: number } | null,
): { command: string; point: { x: number; y: number } } {
  const full = Math.PI * 2;
  let sweep = end - start;
  if (!counterclockwise && sweep < 0) sweep += full;
  if (counterclockwise && sweep > 0) sweep -= full;
  if (Math.abs(sweep) > full) sweep = counterclockwise ? -full : full;
  const endAngle = start + sweep;
  const startPoint = {
    x: x + radius * Math.cos(start),
    y: y + radius * Math.sin(start),
  };
  const endPoint = {
    x: x + radius * Math.cos(endAngle),
    y: y + radius * Math.sin(endAngle),
  };
  const prefix = current
    ? `${
        current.x === startPoint.x && current.y === startPoint.y
          ? ''
          : `L ${number(startPoint.x)} ${number(startPoint.y)} `
      }`
    : `M ${number(startPoint.x)} ${number(startPoint.y)} `;
  const large = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = counterclockwise ? 0 : 1;
  if (Math.abs(sweep) >= full - 0.0001) {
    const middleAngle = start + (counterclockwise ? -Math.PI : Math.PI);
    const middlePoint = {
      x: x + radius * Math.cos(middleAngle),
      y: y + radius * Math.sin(middleAngle),
    };
    return {
      command: `${prefix}A ${number(radius)} ${number(
        radius,
      )} 0 1 ${sweepFlag} ${number(middlePoint.x)} ${number(
        middlePoint.y,
      )} A ${number(radius)} ${number(radius)} 0 1 ${sweepFlag} ${number(
        startPoint.x,
      )} ${number(startPoint.y)}`,
      point: endPoint,
    };
  }
  return {
    command: `${prefix}A ${number(radius)} ${number(
      radius,
    )} 0 ${large} ${sweepFlag} ${number(endPoint.x)} ${number(endPoint.y)}`,
    point: endPoint,
  };
}

/** A small CanvasRenderingContext2D recorder for react-native-svg. */
export class SvgDrawingContext implements DrawingContext2D {
  readonly canvas: { width: number; height: number };
  private current = state();
  private readonly stack: State[] = [];
  private path = '';
  private currentPoint: { x: number; y: number } | null = null;
  private readonly elements: string[] = [];

  constructor(width: number, height: number) {
    this.canvas = { width, height };
  }

  get fillStyle(): string | object {
    return this.current.fillStyle;
  }
  set fillStyle(value: string | object) {
    this.current.fillStyle = colour(value);
  }
  get strokeStyle(): string | object {
    return this.current.strokeStyle;
  }
  set strokeStyle(value: string | object) {
    this.current.strokeStyle = colour(value);
  }
  get lineWidth(): number {
    return this.current.lineWidth;
  }
  set lineWidth(value: number) {
    if (Number.isFinite(value) && value > 0) this.current.lineWidth = value;
  }
  get lineCap(): string {
    return this.current.lineCap;
  }
  set lineCap(value: string) {
    this.current.lineCap = value;
  }
  get lineJoin(): string {
    return this.current.lineJoin;
  }
  set lineJoin(value: string) {
    this.current.lineJoin = value;
  }
  get font(): string {
    return this.current.font;
  }
  set font(value: string) {
    this.current.font = value;
  }
  get globalAlpha(): number {
    return this.current.globalAlpha;
  }
  set globalAlpha(value: number) {
    if (Number.isFinite(value) && value >= 0 && value <= 1)
      this.current.globalAlpha = value;
  }

  save(): void {
    this.stack.push({
      ...this.current,
      matrix: { ...this.current.matrix },
      lineDash: [...this.current.lineDash],
    });
  }
  restore(): void {
    const previous = this.stack.pop();
    if (previous) this.current = previous;
  }
  beginPath(): void {
    this.path = '';
    this.currentPoint = null;
  }
  closePath(): void {
    this.path += 'Z ';
  }
  moveTo(x: number, y: number): void {
    this.path += `M ${number(x)} ${number(y)} `;
    this.currentPoint = { x, y };
  }
  lineTo(x: number, y: number): void {
    this.path += `L ${number(x)} ${number(y)} `;
    this.currentPoint = { x, y };
  }
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void {
    this.path += `C ${number(cp1x)} ${number(cp1y)} ${number(cp2x)} ${number(
      cp2y,
    )} ${number(x)} ${number(y)} `;
    this.currentPoint = { x, y };
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.path += `Q ${number(cpx)} ${number(cpy)} ${number(x)} ${number(y)} `;
    this.currentPoint = { x, y };
  }
  arc(
    x: number,
    y: number,
    radius: number,
    start: number,
    end: number,
    counterclockwise = false,
  ): void {
    const result = pathArc(
      x,
      y,
      radius,
      start,
      end,
      counterclockwise,
      this.currentPoint,
    );
    this.path += result.command + ' ';
    this.currentPoint = result.point;
  }
  rect(x: number, y: number, width: number, height: number): void {
    this.path += `M ${number(x)} ${number(y)} h ${number(width)} v ${number(
      height,
    )} h ${number(-width)} Z `;
    this.currentPoint = { x, y };
  }
  fill(): void {
    this.emitPath('fill');
  }
  stroke(): void {
    this.emitPath('stroke');
  }
  fillRect(x: number, y: number, width: number, height: number): void {
    this.elements.push(
      this.element(
        'rect',
        `x="${number(x)}" y="${number(y)}" width="${number(
          width,
        )}" height="${number(height)}"`,
        'fill',
      ),
    );
  }
  clearRect(_x: number, _y: number, _width: number, _height: number): void {
    // The SVG root is recreated per frame with a white background.
  }
  fillText(text: string, x: number, y: number): void {
    const { size, family, weight } = fontParts(this.current.font);
    this.elements.push(
      this.element(
        'text',
        `x="${number(x)}" y="${number(y)}" font-size="${number(
          size,
        )}" font-family="${esc(family)}" font-weight="${weight}"`,
        'fill',
        esc(text),
      ),
    );
  }
  measureText(text: string): TextMetricsLike {
    const { size } = fontParts(this.current.font);
    return {
      width: text.length * size * 0.56,
      actualBoundingBoxAscent: size * 0.8,
      actualBoundingBoxDescent: size * 0.2,
    };
  }
  translate(x: number, y: number): void {
    this.multiply({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
  }
  scale(x: number, y: number): void {
    this.multiply({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 });
  }
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void {
    this.current.matrix = { a, b, c, d, e, f };
  }
  getTransform(): TransformLike {
    return { ...this.current.matrix };
  }
  setLineDash(segments: number[]): void {
    this.current.lineDash = [...segments];
  }

  toSvg(background: string | null = 'white'): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(
      this.canvas.width,
    )}" height="${number(this.canvas.height)}" viewBox="0 0 ${number(
      this.canvas.width,
    )} ${number(this.canvas.height)}">${
      background === null
        ? ''
        : `<rect width="100%" height="100%" fill="${esc(background)}"/>`
    }${this.elements.join('')}</svg>`;
  }

  private multiply(next: Matrix): void {
    const a = this.current.matrix;
    this.current.matrix = {
      a: a.a * next.a + a.c * next.b,
      b: a.b * next.a + a.d * next.b,
      c: a.a * next.c + a.c * next.d,
      d: a.b * next.c + a.d * next.d,
      e: a.a * next.e + a.c * next.f + a.e,
      f: a.b * next.e + a.d * next.f + a.f,
    };
  }

  private emitPath(kind: 'fill' | 'stroke'): void {
    if (!this.path) return;
    this.elements.push(this.element('path', `d="${this.path.trim()}"`, kind));
  }

  private element(
    tag: string,
    attributes: string,
    kind: 'fill' | 'stroke',
    content = '',
  ): string {
    const fill = kind === 'fill' ? esc(this.current.fillStyle) : 'none';
    const stroke = kind === 'stroke' ? esc(this.current.strokeStyle) : 'none';
    const dash =
      this.current.lineDash.length > 0
        ? ` stroke-dasharray="${this.current.lineDash.map(number).join(' ')}"`
        : '';
    const common = `transform="${matrixValue(
      this.current.matrix,
    )}" fill="${fill}" stroke="${stroke}" stroke-width="${number(
      this.current.lineWidth,
    )}" stroke-linecap="${this.current.lineCap}" stroke-linejoin="${
      this.current.lineJoin
    }" opacity="${number(this.current.globalAlpha)}"${dash}`;
    return `<${tag} ${attributes} ${common}>${content}${
      content ? `</${tag}>` : `</${tag}>`
    }`;
  }
}
