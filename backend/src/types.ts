export interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedField {
  name: string;
  suggestedName: string;
  type: string;
  page: number;
  rect: FieldRect;
  nearbyText: string[];
}

export interface ExtractResponse {
  fields: ExtractedField[];
  pageCount: number;
}
