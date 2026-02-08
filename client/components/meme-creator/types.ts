// components/meme-creator/types.ts
export interface Position {
  x: number;
  y: number;
}

export interface TextBox {
  id: string;
  text: string;
  position: Position;
  fontSize: number;
  color: string;
}

export interface Template {
  id: string;
  src: string;
  alt: string;
}