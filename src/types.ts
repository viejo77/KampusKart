export interface StudentRecord {
  id: string;
  studentNumber: string; // Okul Numarası (with optional AMP/ATP prefix e.g., AMP-1042)
  fullName: string; // Adı Soyadı
  schoolName: string; // Okul İsmi (supports 2 lines)
  className: string; // Sınıfı (e.g., AMP 9-A, ATP 10-B)
  fieldOfStudy?: string; // Alanı / Bölümü (e.g., Bilişim Teknolojileri, Elektrik-Elektronik vb.)
  academicYear?: string; // Öğretim Yılı (e.g., 2026-2030 (4 Yıl))
  bloodType?: string; // Kan Grubu (optional, shown on back side)
  emergencyPhone?: string; // Veli / Acil Durum Tel (optional, shown on back side)
  photoDataUrl?: string; // Matched or default photo data URL
  photoFileName?: string;
}

export type FrontFieldKey =
  | 'photo'
  | 'fullName'
  | 'studentNumber'
  | 'className'
  | 'schoolName'
  | 'academicYear'
  | 'cardTitle'
  | 'barcode';

export type BackFieldKey =
  | 'backTitle'
  | 'returnNotice'
  | 'schoolAddress'
  | 'schoolPhone'
  | 'schoolWebsite'
  | 'studentInfoSummary'
  | 'studentSignatureBox'
  | 'principalApproval'
  | 'backBarcode';

export type FieldKey = FrontFieldKey | BackFieldKey;

export interface FieldPosition {
  id: FieldKey;
  label: string;
  visible: boolean;
  x: number; // percentage 0-100 of card width
  y: number; // percentage 0-100 of card height
  width?: number; // percentage 0-100 (primarily for photo, signature box & barcode)
  height?: number; // percentage 0-100
  fontSize: number; // in pt/px relative to standard 1012x638 canvas (for schoolName, this is 1st line font size)
  secondLineFontSize?: number; // independent font size for the 2nd line (used in 2-line schoolName)
  secondLineAlign?: 'left' | 'center' | 'right'; // independent horizontal alignment for the 2nd line of schoolName
  secondLineX?: number; // optional independent X position (0-100%) for the 2nd line of schoolName
  secondLineYOffset?: number; // optional vertical spacing adjustment in px between 1st and 2nd line
  fontWeight: '400' | '600' | '700';
  color: string;
  align: 'left' | 'center' | 'right';
  showPrefix?: boolean;
  prefixText?: string;
  customText?: string; // used for editable static/template text on back side (e.g., address, phone, return notice)
  borderRadius?: number; // percentage for photo/box rounding
  borderWidth?: number;
  borderColor?: string;
}

export type BuiltInThemeId =
  | 'meb-classic'
  | 'modern-campus'
  | 'emerald-college'
  | 'vertical-lanyard';

export interface WatermarkConfig {
  enabled: boolean;
  type: 'text' | 'logo';
  text: string; // e.g., "ÖRNEK", "TASLAK", or School Name
  layer: 'background' | 'overlay'; // 'background' (behind fields/photo) or 'overlay' (on top of card)
  opacity: number; // 0.03 to 0.50
  scale: number; // 20 to 120 (%)
  rotation: number; // -60 to 60 degrees
  repeatedPattern: boolean; // single centered watermark vs tiled diagonal pattern
  applyToBackSide: boolean; // whether to also draw watermark on back side
}

export interface CardTemplate {
  id: BuiltInThemeId;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait'; // CR80 85.6x54mm or 54x85.6mm
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  customBackgroundUrl?: string;
  customBackBackgroundUrl?: string;
  schoolLogoUrl?: string;
  schoolLogoStyle?: 'badge' | 'transparent'; // Badge backing for high-contrast crisp PNG logo rendering
  schoolLogoScale?: number; // 70 to 140 (%) scale multiplier
  principalSignatureUrl?: string; // Optional uploaded signature/stamp image for back side
  defaultSchoolName: string;
  defaultAcademicYear: string;
  cardTitleText: string;
  enableBackSide: boolean; // Optional back side toggle
  watermark?: WatermarkConfig;
  fields: Record<FrontFieldKey, FieldPosition>;
  backFields: Record<BackFieldKey, FieldPosition>;
}

export interface PdfExportSettings {
  layoutMode: 'a4-grid' | 'single-card';
  includeBackSide: boolean; // Automatically synced or overridden when template has back side enabled
  showCropMarks: boolean;
  cardSpacingMm: number;
  qualityScale: number;
}
