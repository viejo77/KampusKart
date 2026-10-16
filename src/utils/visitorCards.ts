import { StudentRecord } from '../types';

/**
 * Creates high-resolution vector badge avatars for Visitor and Staff ID cards.
 * Ensures the photo slot looks crisp, official, and purposeful.
 */
export function createVisitorBadgeAvatarSvg(
  type: 'visitor' | 'staff',
  cardNo: string,
  badgeTitle: string
): string {
  const isVisitor = type === 'visitor';
  const primaryBg = isVisitor ? '#1e3a8a' : '#065f46';
  const secondaryBg = isVisitor ? '#3b82f6' : '#10b981';
  const accentGold = '#f59e0b';
  const labelText = isVisitor ? 'ZİYARETÇİ' : 'GÖREVLİ';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 380" width="300" height="380">
    <defs>
      <linearGradient id="vbg-${type}-${cardNo}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${primaryBg}" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
      <linearGradient id="ribbon-${type}-${cardNo}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${secondaryBg}" />
        <stop offset="100%" stop-color="${accentGold}" />
      </linearGradient>
      <filter id="shadow-${type}-${cardNo}" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.25" />
      </filter>
    </defs>
    
    <!-- Background Card -->
    <rect width="300" height="380" fill="url(#vbg-${type}-${cardNo})" />
    
    <!-- Subtle pattern lines -->
    <circle cx="150" cy="140" r="110" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2" />
    <circle cx="150" cy="140" r="85" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2" stroke-dasharray="6,4" />
    
    <!-- Main Center Badge / Shield -->
    <g filter="url(#shadow-${type}-${cardNo})">
      <path d="M150 45 L220 80 V165 C220 220 150 250 150 250 C150 250 80 220 80 165 V80 Z" fill="#ffffff" fill-opacity="0.12" stroke="${accentGold}" stroke-width="3" />
      
      ${
        isVisitor
          ? `<!-- Visitor Icon (Guest Silhouette + Keycard) -->
             <circle cx="150" cy="115" r="28" fill="#ffffff" />
             <path d="M110 185 C110 155 130 148 150 148 C170 148 190 155 190 185 Z" fill="#ffffff" />
             <!-- Keycard Icon -->
             <rect x="180" y="165" width="22" height="30" rx="3" fill="${accentGold}" />
             <circle cx="191" cy="172" r="2.5" fill="#1e3a8a" />`
          : `<!-- Staff Icon (Official Star Crest + Shield) -->
             <circle cx="150" cy="130" r="32" fill="#ffffff" />
             <path d="M150 108 L157 122 L172 124 L161 135 L164 150 L150 142 L136 150 L139 135 L128 124 L143 122 Z" fill="${primaryBg}" />
             <path d="M106 195 C106 165 130 160 150 160 C170 160 194 165 194 195 Z" fill="#ffffff" />`
      }
    </g>
    
    <!-- Header Ribbon -->
    <rect x="25" y="260" width="250" height="36" rx="6" fill="url(#ribbon-${type}-${cardNo})" />
    <text x="150" y="284" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">
      ${labelText}
    </text>
    
    <!-- Secondary Badge Number -->
    <text x="150" y="325" font-family="'Courier New', monospace" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1">
      ${cardNo}
    </text>
    
    <!-- Micro Security Text -->
    <text x="150" y="352" font-family="Arial, sans-serif" font-size="9" font-weight="600" fill="#94a3b8" text-anchor="middle" letter-spacing="0.5">
      ${badgeTitle.toUpperCase()}
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface VisitorCardOptions {
  schoolName: string;
  prefix?: string;
  title?: string;
  subtitle?: string;
  namePattern?: string; // e.g. "ZİYARETÇİ - {no}" or "ZİYARETÇİ"
  validity?: string;
  startNumber?: number;
}

/**
 * Generates an array of Ziyaretçi (Visitor) cards compatible with StudentRecord.
 * Photo is deliberately omitted (undefined) per user requirement ("fotoğraf kısmı olmasın").
 */
export function generateVisitorCards(
  count: number,
  options: VisitorCardOptions
): StudentRecord[] {
  const safeCount = Math.max(1, Math.min(200, count));
  const prefix = (options.prefix || 'ZYR').trim().toUpperCase();
  const subtitle = options.subtitle || 'Günübirlik Misafir Girişi';
  const validity = options.validity || 'GÜNÜBİRLİK';
  const startNum = options.startNumber || 1;
  const namePattern = options.namePattern?.trim() || 'ZİYARETÇİ - {no}';

  const result: StudentRecord[] = [];
  for (let i = 0; i < safeCount; i++) {
    const num = startNum + i;
    const cardCode = `${prefix}-${String(num).padStart(3, '0')}`;
    const formattedName = namePattern
      .replace('{no}', String(num).padStart(2, '0'))
      .replace('{num}', String(num));

    result.push({
      id: `visitor-${Date.now()}-${i}`,
      studentNumber: cardCode,
      fullName: formattedName,
      className: 'Güvenlik Kayıtlı',
      fieldOfStudy: subtitle,
      schoolName: options.schoolName,
      academicYear: validity,
      bloodType: '-',
      emergencyPhone: 'Nizamiye Güvenlik',
      photoDataUrl: undefined,
      photoFileName: undefined,
    });
  }

  return result;
}

export interface StaffCardOptions {
  schoolName: string;
  prefix?: string;
  title?: string;
  subtitle?: string;
  namePattern?: string; // e.g. "GÖREVLİ - {no}" or "GÖREVLİ PERSONEL"
  validity?: string;
  startNumber?: number;
}

/**
 * Generates an array of Görevli (Staff/Duty) cards compatible with StudentRecord.
 * Photo is deliberately omitted (undefined) per user requirement ("fotoğraf kısmı olmasın").
 */
export function generateStaffCards(
  count: number,
  options: StaffCardOptions
): StudentRecord[] {
  const safeCount = Math.max(1, Math.min(200, count));
  const prefix = (options.prefix || 'GRV').trim().toUpperCase();
  const subtitle = options.subtitle || 'Sınav & Etkinlik Görevlisi';
  const validity = options.validity || '2026-2027';
  const startNum = options.startNumber || 1;
  const namePattern = options.namePattern?.trim() || 'GÖREVLİ - {no}';

  const result: StudentRecord[] = [];
  for (let i = 0; i < safeCount; i++) {
    const num = startNum + i;
    const cardCode = `${prefix}-${String(num).padStart(3, '0')}`;
    const formattedName = namePattern
      .replace('{no}', String(num).padStart(2, '0'))
      .replace('{num}', String(num));

    result.push({
      id: `staff-${Date.now()}-${i}`,
      studentNumber: cardCode,
      fullName: formattedName,
      className: 'Kurum Personeli',
      fieldOfStudy: subtitle,
      schoolName: options.schoolName,
      academicYear: validity,
      bloodType: '-',
      emergencyPhone: 'Okul İdaresi',
      photoDataUrl: undefined,
      photoFileName: undefined,
    });
  }

  return result;
}

