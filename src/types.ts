export interface StudentRecord {
  id: string;
  studentNumber: string; // Okul Numarası (also used to match photo filename e.g., 1042.jpg)
  fullName: string; // Adı Soyadı
  schoolName: string; // Okul İsmi (supports 2 lines)
  className: string; // Sınıfı (e.g., 10-A)
  academicYear?: string; // Öğretim Yılı (e.g., 2026-2027)
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
  fontSize: number; // in pt/px relative to standard 1012x638 canvas
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
  principalSignatureUrl?: string; // Optional uploaded signature/stamp image for back side
  defaultSchoolName: string;
  defaultAcademicYear: string;
  cardTitleText: string;
  enableBackSide: boolean; // Optional back side toggle
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
