import JSZip from 'jszip';
import {
  BackFieldKey,
  CardTemplate,
  FieldPosition,
  FrontFieldKey,
  StudentRecord,
  WatermarkConfig,
} from '../types';
import { CARD_HEIGHT_LANDSCAPE, CARD_WIDTH_LANDSCAPE } from './cardRenderer';

// CR80 dimensions in millimeters: 85.6 mm x 54.0 mm
export const CARD_WIDTH_MM_LANDSCAPE = 85.6;
export const CARD_HEIGHT_MM_LANDSCAPE = 54.0;

export const SVG_FONT_FAMILY = "NotoSans, Arial, 'Segoe UI', Tahoma, 'Plus Jakarta Sans', sans-serif";

export function normalizeSvgFontWeight(weight?: string | number): 'normal' | 'bold' {
  if (!weight) return 'normal';
  const str = String(weight).toLowerCase();
  if (
    str === 'bold' ||
    str === '700' ||
    str === '800' ||
    str === '900' ||
    str === '600' ||
    str.includes('bold')
  ) {
    return 'bold';
  }
  return 'normal';
}

export function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitizes any string into a valid XML ID / NCName (no spaces, only alphanumeric and _ -)
 */
export function sanitizeXmlId(input: string): string {
  if (!input) return 'id_0';
  const clean = input.replace(/[^a-zA-Z0-9_-]/g, '_');
  return /^[a-zA-Z_]/.test(clean) ? clean : `id_${clean}`;
}

/**
 * Extracts inner vector graphics from an SVG string or SVG data URI so it can be inlined directly
 */
export function extractSvgContent(svgStrOrDataUrl: string): { innerContent: string; viewBoxW: number; viewBoxH: number } | null {
  try {
    let raw = (svgStrOrDataUrl || '').trim();
    if (!raw) return null;
    if (raw.startsWith('data:image/svg+xml')) {
      const commaIdx = raw.indexOf(',');
      if (commaIdx !== -1) {
        const meta = raw.slice(0, commaIdx);
        const body = raw.slice(commaIdx + 1);
        if (meta.includes('base64')) {
          try {
            raw = atob(body.replace(/\s/g, ''));
          } catch {
            raw = '';
          }
        } else {
          try {
            raw = decodeURIComponent(body);
          } catch {
            try {
              raw = decodeURI(body);
            } catch {
              raw = body;
            }
          }
        }
      }
    }
    if (!raw.includes('<svg')) return null;

    const vbMatch = raw.match(/viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i);
    const viewBoxW = vbMatch ? parseFloat(vbMatch[3]) : 300;
    const viewBoxH = vbMatch ? parseFloat(vbMatch[4]) : 380;

    const startTagEnd = raw.indexOf('>');
    const closeTagStart = raw.lastIndexOf('</svg>');
    if (startTagEnd !== -1 && closeTagStart !== -1 && closeTagStart > startTagEnd) {
      const innerContent = raw.slice(startTagEnd + 1, closeTagStart);
      return { innerContent, viewBoxW: viewBoxW > 0 ? viewBoxW : 300, viewBoxH: viewBoxH > 0 ? viewBoxH : 380 };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates rich, official MEB student portrait vector curves (for vector PDF and CorelDRAW)
 * so NO student is ever rendered with an empty or broken photo box.
 */
export function generateStudentVectorPortraitSvg(student: StudentRecord, index: number = 0): string {
  const skinPalette = ['#f5d0b5', '#ecc1a1', '#f7d7c4', '#e5b899', '#f3cfb6', '#eab996'];
  const hairPalette = ['#271c19', '#452c1e', '#5c3a21', '#1c1917', '#3b2314', '#292524'];
  const shirtPalette = ['#1e3a8a', '#0f172a', '#1e293b', '#0369a1', '#065f46', '#334155'];
  const bgPalette = ['#e2e8f0', '#dbeafe', '#e0f2fe', '#f1f5f9', '#f8fafc', '#ecfdf5'];

  const lowerName = (student.fullName || '').toLowerCase();
  const isFemale =
    lowerName.endsWith('a') ||
    lowerName.endsWith('e') ||
    lowerName.includes('elif') ||
    lowerName.includes('zeynep') ||
    lowerName.includes('defne') ||
    lowerName.includes('ayşe') ||
    lowerName.includes('fatma') ||
    lowerName.includes('merve') ||
    lowerName.includes('büşra') ||
    lowerName.includes('irem') ||
    index % 2 === 0;

  const bgHex = bgPalette[index % bgPalette.length];
  const shirtHex = shirtPalette[index % shirtPalette.length];
  const hairHex = hairPalette[index % hairPalette.length];
  const skinHex = skinPalette[index % skinPalette.length];

  return `
    <rect width="300" height="380" fill="${bgHex}" />
    <circle cx="150" cy="145" r="130" fill="#ffffff" fill-opacity="0.22" />
    <path d="M35 380 C35 288 85 265 150 265 C215 265 265 288 265 380 Z" fill="${shirtHex}" />
    <polygon points="118,265 150,315 182,265" fill="#ffffff" />
    <polygon points="143,288 157,288 160,355 150,368 140,355" fill="#991b1b" />
    <rect x="128" y="215" width="44" height="62" rx="18" fill="${skinHex}" />
    ${
      isFemale
        ? `<path d="M78 135 C70 210 78 265 95 280 C115 285 185 285 205 280 C222 265 230 210 222 135 Z" fill="${hairHex}" />`
        : ''
    }
    <circle cx="88" cy="162" r="14" fill="${skinHex}" />
    <circle cx="212" cy="162" r="14" fill="${skinHex}" />
    <rect x="92" y="82" width="116" height="150" rx="56" fill="${skinHex}" />
    <circle cx="126" cy="152" r="5.5" fill="#1e293b" />
    <circle cx="174" cy="152" r="5.5" fill="#1e293b" />
    <circle cx="128" cy="150" r="1.8" fill="#ffffff" />
    <circle cx="176" cy="150" r="1.8" fill="#ffffff" />
    <path d="M113 137 Q126 132 137 137" stroke="${hairHex}" stroke-width="4" stroke-linecap="round" fill="none" />
    <path d="M163 137 Q174 132 187 137" stroke="${hairHex}" stroke-width="4" stroke-linecap="round" fill="none" />
    <path d="M150 155 L146 176 L154 178" stroke="#c28e70" stroke-width="2.5" stroke-linecap="round" fill="none" />
    <path d="M133 196 Q150 209 167 196" stroke="#a85544" stroke-width="3.5" stroke-linecap="round" fill="none" />
    ${
      isFemale
        ? `<path d="M88 140 C85 82 115 66 150 66 C185 66 215 82 212 140 C200 108 175 96 150 98 C125 96 100 108 88 140 Z" fill="${hairHex}" />`
        : `<path d="M90 135 C86 78 115 65 150 65 C185 65 214 78 210 135 C198 102 180 94 150 94 C120 94 102 102 90 135 Z" fill="${hairHex}" />`
    }
  `;
}

/**
 * Builds vector SVG background for front side based on built-in theme or custom image
 */
function renderCardBackgroundSvg(
  template: CardTemplate,
  W: number,
  H: number
): string {
  if (template.customBackgroundUrl) {
    return `<image href="${escapeXml(template.customBackgroundUrl)}" xlink:href="${escapeXml(template.customBackgroundUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" />`;
  }

  const bg = escapeXml(template.backgroundColor || '#ffffff');
  const primary = escapeXml(template.primaryColor);
  const secondary = escapeXml(template.secondaryColor || '#2563eb');
  const accent = escapeXml(template.accentColor || '#d97706');

  if (template.id === 'meb-classic') {
    const headerH = H * 0.235;
    return `
      <rect width="${W}" height="${H}" fill="${bg}" />
      <rect x="0" y="0" width="${W}" height="${headerH}" fill="${primary}" />
      <rect x="0" y="${headerH}" width="${W}" height="${H * 0.016}" fill="${accent}" />
      <circle cx="${W * 0.86}" cy="${H * 0.62}" r="${H * 0.34}" fill="${primary}" fill-opacity="0.04" />
      <rect x="0" y="${H * 0.945}" width="${W}" height="${H * 0.055}" fill="${primary}" />
      <rect x="0" y="${H * 0.935}" width="${W}" height="${H * 0.01}" fill="${accent}" />
    `;
  }

  if (template.id === 'modern-campus') {
    return `
      <rect width="${W}" height="${H}" fill="${bg}" />
      <polygon points="0,0 ${W},0 ${W},${H * 0.24} 0,${H * 0.2}" fill="${primary}" />
      <polygon points="${W * 0.62},${H * 0.2} ${W},${H * 0.22} ${W},${H} ${W * 0.54},${H}" fill="${accent}" fill-opacity="0.16" />
      <rect x="0" y="${H * 0.94}" width="${W}" height="${H * 0.06}" fill="${secondary}" />
    `;
  }

  if (template.id === 'emerald-college') {
    const headerH = H * 0.23;
    return `
      <rect width="${W}" height="${H}" fill="${bg}" />
      <rect x="0" y="0" width="${W}" height="${headerH}" fill="${primary}" />
      <rect x="0" y="${headerH}" width="${W}" height="${H * 0.012}" fill="${accent}" />
      <rect x="0" y="${headerH + H * 0.02}" width="${W}" height="${H * 0.005}" fill="${accent}" />
      <rect x="${W * 0.025}" y="${H * 0.27}" width="${W * 0.95}" height="${H * 0.66}" fill="none" stroke="${primary}" stroke-width="2" />
      <rect x="0" y="${H * 0.95}" width="${W}" height="${H * 0.05}" fill="${primary}" />
    `;
  }

  if (template.id === 'vertical-lanyard') {
    const headerH = H * 0.3;
    return `
      <rect width="${W}" height="${H}" fill="${bg}" />
      <path d="M 0 0 L ${W} 0 L ${W} ${headerH * 0.85} Q ${W * 0.5} ${headerH * 1.15} 0 ${headerH * 0.85} Z" fill="${primary}" />
      <rect x="${W * 0.41}" y="${H * 0.022}" width="${W * 0.18}" height="${H * 0.018}" rx="8" ry="8" fill="#e2e8f0" />
      <rect x="0" y="${H * 0.96}" width="${W}" height="${H * 0.04}" fill="${secondary}" />
    `;
  }

  return `<rect width="${W}" height="${H}" fill="${bg}" />`;
}

/**
 * Builds vector SVG background for back side
 */
function renderCardBackBackgroundSvg(
  template: CardTemplate,
  W: number,
  H: number,
  isLandscape: boolean
): string {
  if (template.customBackBackgroundUrl) {
    return `<image href="${escapeXml(template.customBackBackgroundUrl)}" xlink:href="${escapeXml(template.customBackBackgroundUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" />`;
  }

  const bg = escapeXml(template.backgroundColor || '#ffffff');
  const primary = escapeXml(template.primaryColor);
  const accent = escapeXml(template.accentColor || '#d97706');
  const topBarH = isLandscape ? H * 0.155 : H * 0.135;

  return `
    <rect width="${W}" height="${H}" fill="${bg}" />
    <rect x="0" y="0" width="${W}" height="${topBarH}" fill="${primary}" />
    <rect x="0" y="${topBarH}" width="${W}" height="${H * 0.012}" fill="${accent}" />
    <rect x="${W * 0.04}" y="${topBarH + H * 0.03}" width="${W * 0.92}" height="${H * 0.12}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    <rect x="0" y="${H * 0.945}" width="${W}" height="${H * 0.055}" fill="${primary}" />
    <rect x="0" y="${H * 0.935}" width="${W}" height="${H * 0.01}" fill="${accent}" />
  `;
}

/**
 * Renders vector school logo / emblem
 */
function renderSchoolLogoSvg(
  template: CardTemplate,
  W: number,
  H: number,
  isLandscape: boolean
): string {
  if (!template.schoolLogoUrl || template.showSchoolLogo === false) return '';

  const isModern = template.id === 'modern-campus';
  const scaleMultiplier = (template.schoolLogoScale || 100) / 100;
  const baseLogoSize = isLandscape ? (isModern ? H * 0.18 : H * 0.17) : W * 0.18;
  const logoSize = baseLogoSize * scaleMultiplier;
  const lx = isModern ? W * 0.042 : isLandscape ? W * 0.046 : W * 0.055;
  const ly = isModern ? H * 0.026 : H * 0.032;

  const cx = lx + logoSize / 2;
  const cy = ly + logoSize / 2;
  const useBadge = template.schoolLogoStyle !== 'transparent';

  let badgeSvg = '';
  if (useBadge) {
    const radius = logoSize * 0.52;
    badgeSvg = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#ffffff" stroke="${escapeXml(template.accentColor || '#d97706')}" stroke-width="2.5" />
    `;
  }

  const innerSize = useBadge ? logoSize * 0.88 : logoSize;
  const logoX = cx - innerSize / 2;
  const logoY = cy - innerSize / 2;

  return `
    <g id="school-logo">
      ${badgeSvg}
      <image href="${escapeXml(template.schoolLogoUrl)}" xlink:href="${escapeXml(template.schoolLogoUrl)}" x="${logoX}" y="${logoY}" width="${innerSize}" height="${innerSize}" preserveAspectRatio="xMidYMid meet" />
    </g>
  `;
}

/**
 * Renders vector watermark layer
 */
function renderWatermarkSvg(
  template: CardTemplate,
  W: number,
  H: number,
  side: 'front' | 'back',
  targetLayer: 'background' | 'overlay'
): string {
  const wm: WatermarkConfig | undefined = template.watermark;
  if (!wm || !wm.enabled) return '';
  if (wm.layer !== targetLayer) return '';
  if (side === 'back' && !wm.applyToBackSide) return '';

  const opacity = Math.max(0.02, Math.min(0.7, wm.opacity ?? 0.12));
  const scalePct = Math.max(15, Math.min(130, wm.scale ?? 55));
  const rotation = wm.rotation ?? -25;

  const renderSingle = (cx: number, cy: number, scaleFactor = 1) => {
    if (wm.type === 'logo' && template.schoolLogoUrl && template.showSchoolLogo !== false) {
      const size = Math.min(W, H) * (scalePct / 100) * scaleFactor;
      return `
        <g transform="translate(${cx}, ${cy}) rotate(${rotation})">
          <image href="${escapeXml(template.schoolLogoUrl)}" xlink:href="${escapeXml(template.schoolLogoUrl)}" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />
        </g>
      `;
    }
    const text = escapeXml(wm.text || template.cardTitleText || 'ÖRNEK');
    const fontSize = Math.max(18, Math.round(Math.min(W, H) * (scalePct / 100) * 0.34 * scaleFactor));
    return `
      <g transform="translate(${cx}, ${cy}) rotate(${rotation})">
        <text x="0" y="0" font-family="${SVG_FONT_FAMILY}" font-size="${fontSize}" font-weight="bold" fill="${escapeXml(template.primaryColor)}" text-anchor="middle" dy="0.35em" letter-spacing="2">${text}</text>
      </g>
    `;
  };

  if (wm.repeatedPattern) {
    const stepX = W * 0.36;
    const stepY = H * 0.34;
    let items = '';
    for (let y = -H * 0.2; y <= H * 1.2; y += stepY) {
      for (let x = -W * 0.2; x <= W * 1.2; x += stepX) {
        items += renderSingle(x, y, 0.55);
      }
    }
    return `<g id="watermark-${targetLayer}" opacity="${opacity}">${items}</g>`;
  }

  const centerY = targetLayer === 'background' ? H * 0.56 : H * 0.52;
  return `<g id="watermark-${targetLayer}" opacity="${opacity}">${renderSingle(W * 0.5, centerY, 1)}</g>`;
}

/**
 * Renders pure vector barcode lines and numbers
 */
function renderSimulatedBarcodeSvg(
  x: number,
  y: number,
  w: number,
  h: number,
  studentNumber: string,
  color: string
): string {
  const seedStr = `${studentNumber || '0000'}987654321`;
  const totalBars = 44;
  const barAreaWidth = w;
  const unitWidth = barAreaWidth / (totalBars * 1.65);
  const strokeColor = escapeXml(color || '#0f172a');

  let barsSvg = '';
  let currentX = x;
  for (let i = 0; i < totalBars; i++) {
    const charCode = seedStr.charCodeAt(i % seedStr.length);
    const barThick = ((i + charCode) % 3) + 1;
    const gapThick = ((i * 2 + charCode) % 2) + 1;
    const bw = unitWidth * barThick * 0.72;
    if (currentX + bw <= x + w) {
      barsSvg += `<rect x="${currentX.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${(h * 0.78).toFixed(2)}" fill="${strokeColor}" />`;
    }
    currentX += bw + unitWidth * gapThick * 0.55;
  }

  const fontSize = Math.max(12, Math.round(h * 0.22));
  const textY = y + h + 2;
  const textX = x + w / 2;

  return `
    <g id="barcode">
      ${barsSvg}
      <text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" font-family="'IBM Plex Mono', 'Courier New', monospace" font-size="${fontSize}" font-weight="500" fill="${strokeColor}" text-anchor="middle" dominant-baseline="alphabetic">* ${escapeXml(studentNumber || '0000')} *</text>
    </g>
  `;
}

/**
 * Builds a single student card as pure vector SVG XML string
 */
export function renderStudentCardToSvgString(
  student: StudentRecord,
  template: CardTemplate,
  options?: {
    side?: 'front' | 'back';
    widthMm?: number;
    heightMm?: number;
    idPrefix?: string;
    includeRootTag?: boolean;
    omitPhoto?: boolean;
  }
): string {
  const side = options?.side || 'front';
  const isLandscape = template.orientation === 'landscape';
  const W = isLandscape ? CARD_WIDTH_LANDSCAPE : CARD_HEIGHT_LANDSCAPE;
  const H = isLandscape ? CARD_HEIGHT_LANDSCAPE : CARD_WIDTH_LANDSCAPE;
  const widthMm = options?.widthMm ?? (isLandscape ? CARD_WIDTH_MM_LANDSCAPE : CARD_HEIGHT_MM_LANDSCAPE);
  const heightMm = options?.heightMm ?? (isLandscape ? CARD_HEIGHT_MM_LANDSCAPE : CARD_WIDTH_MM_LANDSCAPE);
  const rawPrefix = options?.idPrefix || `card_${student.id || student.studentNumber || '0'}`;
  const prefix = sanitizeXmlId(rawPrefix);
  const includeRoot = options?.includeRootTag ?? true;

  // ================= BACK SIDE VECTOR SVG =================
  if (side === 'back') {
    const backBg = renderCardBackBackgroundSvg(template, W, H, isLandscape);
    const bgWatermark = renderWatermarkSvg(template, W, H, 'back', 'background');
    const overlayWatermark = renderWatermarkSvg(template, W, H, 'back', 'overlay');

    let fieldsSvg = '';
    const backOrder: BackFieldKey[] = [
      'backTitle',
      'returnNotice',
      'schoolAddress',
      'schoolPhone',
      'schoolWebsite',
      'studentInfoSummary',
      'studentSignatureBox',
      'principalApproval',
      'backBarcode',
    ];

    for (const key of backOrder) {
      const field = template.backFields?.[key];
      if (!field || !field.visible) continue;

      const px = (field.x / 100) * W;
      const py = (field.y / 100) * H;

      if (key === 'studentSignatureBox' || key === 'principalApproval') {
        const pw = ((field.width || 30) / 100) * W;
        const ph = ((field.height || 24) / 100) * H;
        const radius = ((field.borderRadius ?? 8) / 100) * Math.min(pw, ph);
        const isPrincipal = key === 'principalApproval';

        const lines = (field.customText || (isPrincipal ? 'OKUL MÜDÜRÜ\nİmza / Mühür' : 'ÖĞRENCİ İMZASI'))
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        let linesSvg = '';
        lines.forEach((l, idx) => {
          const ly = py + 18 + idx * (field.fontSize + 4);
          linesSvg += `<text x="${(px + pw / 2).toFixed(1)}" y="${ly.toFixed(1)}" font-family="${SVG_FONT_FAMILY}" font-size="${field.fontSize}" font-weight="${normalizeSvgFontWeight(field.fontWeight || '700')}" fill="${escapeXml(field.color || '#334155')}" text-anchor="middle">${escapeXml(l)}</text>`;
        });

        let sealOrSigSvg = '';
        if (isPrincipal && template.principalSignatureUrl) {
          const maxW = pw * 0.75;
          const maxH = ph * 0.55;
          sealOrSigSvg = `<image href="${escapeXml(template.principalSignatureUrl)}" xlink:href="${escapeXml(template.principalSignatureUrl)}" x="${(px + (pw - maxW) / 2).toFixed(1)}" y="${(py + ph * 0.36).toFixed(1)}" width="${maxW.toFixed(1)}" height="${maxH.toFixed(1)}" preserveAspectRatio="xMidYMid meet" />`;
        } else if (isPrincipal) {
          const sealR = Math.min(pw, ph) * 0.24;
          const scx = px + pw * 0.76;
          const scy = py + ph * 0.58;
          sealOrSigSvg = `
            <circle cx="${scx.toFixed(1)}" cy="${scy.toFixed(1)}" r="${sealR.toFixed(1)}" fill="none" stroke="#1e3a8a" stroke-width="2" opacity="0.18" />
            <circle cx="${scx.toFixed(1)}" cy="${scy.toFixed(1)}" r="${(sealR * 0.75).toFixed(1)}" fill="none" stroke="#1e3a8a" stroke-width="2" opacity="0.18" />
          `;
        }

        fieldsSvg += `
          <g id="${prefix}-${key}">
            <rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" rx="${radius.toFixed(1)}" ry="${radius.toFixed(1)}" fill="#f8fafc" stroke="${escapeXml(field.borderColor || '#94a3b8')}" stroke-width="${field.borderWidth ?? 2}" stroke-dasharray="6,4" />
            ${linesSvg}
            <line x1="${(px + pw * 0.15).toFixed(1)}" y1="${(py + ph * 0.78).toFixed(1)}" x2="${(px + pw * 0.85).toFixed(1)}" y2="${(py + ph * 0.78).toFixed(1)}" stroke="#cbd5e1" stroke-width="1.5" />
            ${sealOrSigSvg}
          </g>
        `;
        continue;
      }

      if (key === 'backBarcode') {
        const bw = ((field.width || 50) / 100) * W;
        const bh = ((field.height || 9) / 100) * H;
        fieldsSvg += renderSimulatedBarcodeSvg(px, py, bw, bh, student.studentNumber, field.color || '#0f172a');
        continue;
      }

      // Text fields
      let rawText = field.customText || '';
      if (key === 'studentInfoSummary') {
        const blood = student.bloodType || 'Belirtilmedi';
        const emergency = student.emergencyPhone || '-';
        if (rawText.includes('{bloodType}') || rawText.includes('{emergencyPhone}')) {
          rawText = rawText.replace('{bloodType}', blood).replace('{emergencyPhone}', emergency);
        } else if (!rawText.trim()) {
          rawText = `Kan Grubu: ${blood}  ·  Acil Veli Tel: ${emergency}`;
        }
      }

      const textAnchor = field.align === 'center' ? 'middle' : field.align === 'right' ? 'end' : 'start';
      let valueOffsetY = py;
      let prefixSvg = '';
      if (field.showPrefix && field.prefixText) {
        const labelFontSize = Math.max(11, Math.round(field.fontSize * 0.62));
        const prefixBaselineY = py + Math.round(labelFontSize * 0.78);
        prefixSvg = `<text x="${px.toFixed(1)}" y="${prefixBaselineY.toFixed(1)}" font-family="${SVG_FONT_FAMILY}" font-size="${labelFontSize}" font-weight="bold" fill="#64748b" text-anchor="${textAnchor}">${escapeXml(field.prefixText.toLocaleUpperCase('tr-TR'))}</text>`;
        valueOffsetY = py + labelFontSize + 4;
      }

      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const lineHeight = Math.round(field.fontSize * 1.28);
      let linesSvg = '';
      lines.forEach((lineText, idx) => {
        const topY = valueOffsetY + idx * lineHeight;
        const baselineY = topY + Math.round(field.fontSize * 0.78);
        linesSvg += `<text x="${px.toFixed(1)}" y="${baselineY.toFixed(1)}" font-family="${SVG_FONT_FAMILY}" font-size="${field.fontSize}" font-weight="${normalizeSvgFontWeight(field.fontWeight || '600')}" fill="${escapeXml(field.color || '#0f172a')}" text-anchor="${textAnchor}">${escapeXml(lineText)}</text>`;
      });

      fieldsSvg += `<g id="${prefix}-${key}">${prefixSvg}${linesSvg}</g>`;
    }

    const innerSvg = `
      ${backBg}
      ${bgWatermark}
      ${fieldsSvg}
      ${overlayWatermark}
    `;

    if (!includeRoot) return innerSvg;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${widthMm}mm" height="${heightMm}mm" id="${prefix}">
        <defs>
          <style type="text/css">
            text { font-family: 'NotoSans', Arial, 'Segoe UI', Tahoma, 'Plus Jakarta Sans', sans-serif; }
          </style>
        </defs>
        ${innerSvg}
      </svg>
    `.trim();
  }

  // ================= FRONT SIDE VECTOR SVG =================
  const frontBg = renderCardBackgroundSvg(template, W, H);
  const bgWatermark = renderWatermarkSvg(template, W, H, 'front', 'background');
  const overlayWatermark = renderWatermarkSvg(template, W, H, 'front', 'overlay');
  const schoolLogo = renderSchoolLogoSvg(template, W, H, isLandscape);

  let fieldsSvg = '';
  const frontOrder: FrontFieldKey[] = [
    'schoolName',
    'cardTitle',
    'photo',
    'fullName',
    'studentNumber',
    'className',
    'academicYear',
    'barcode',
  ];

  // Photo coordinates for collision avoidance
  const photoField = template.fields['photo'];
  let photoLeft = -1;
  let photoRight = -1;
  if (photoField && photoField.visible) {
    photoLeft = (photoField.x / 100) * W;
    photoRight = photoLeft + (((photoField.width || 25) / 100) * W);
  }

  for (const key of frontOrder) {
    const field: FieldPosition = template.fields[key];
    if (!field || !field.visible) continue;

    const px = (field.x / 100) * W;
    const py = (field.y / 100) * H;

    if (key === 'photo') {
      const pw = ((field.width || 25) / 100) * W;
      const ph = ((field.height || 52) / 100) * H;
      const radius = ((field.borderRadius ?? 6) / 100) * Math.min(pw, ph);

      let photoContentSvg = '';
      const photoUrl = (student.photoDataUrl || '').trim();

      // Check if photo is an SVG (data URI or inline svg)
      const svgInfo = photoUrl ? extractSvgContent(photoUrl) : null;

      if (svgInfo) {
        // Native pure vector rendering for CorelDRAW and Vector PDF.
        // Zero clipPath used: CorelDRAW hoists clipPaths to document root and ignores parent <g transform="...">,
        // which previously caused all cards beyond the first row (cards 2..N) to be clipped out!
        const scaleX = (pw / svgInfo.viewBoxW).toFixed(6);
        const scaleY = (ph / svgInfo.viewBoxH).toFixed(6);
        photoContentSvg = `
          <g id="${prefix}_photo_vector" transform="translate(${px.toFixed(1)}, ${py.toFixed(1)}) scale(${scaleX}, ${scaleY})">
            ${svgInfo.innerContent}
          </g>
        `;
      } else if (photoUrl && (photoUrl.startsWith('data:image') || photoUrl.startsWith('http') || photoUrl.startsWith('blob:'))) {
        // Real raster photo (JPEG, PNG, etc.) directly placed within the frame bounds.
        // Strict SVG 1.1 specification: <image> uses href and xlink:href without non-standard rx/ry.
        photoContentSvg = `
          <image href="${escapeXml(photoUrl)}" xlink:href="${escapeXml(photoUrl)}" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" preserveAspectRatio="xMidYMid slice" />
        `;
      } else {
        // No photo provided: dynamically render rich official vector student portrait so EVERY student has a complete portrait
        const numMatch = (student.studentNumber || '').match(/\d+/);
        const portraitIndex = numMatch ? parseInt(numMatch[0], 10) : 0;
        const portraitInner = generateStudentVectorPortraitSvg(student, portraitIndex);
        const scaleX = (pw / 300).toFixed(6);
        const scaleY = (ph / 380).toFixed(6);
        photoContentSvg = `
          <g id="${prefix}_photo_fallback_vector" transform="translate(${px.toFixed(1)}, ${py.toFixed(1)}) scale(${scaleX}, ${scaleY})">
            ${portraitInner}
          </g>
        `;
      }

      let borderSvg = '';
      if ((field.borderWidth ?? 3) > 0) {
        borderSvg = `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" rx="${radius.toFixed(1)}" ry="${radius.toFixed(1)}" fill="none" stroke="${escapeXml(field.borderColor || template.primaryColor)}" stroke-width="${field.borderWidth ?? 3}" />`;
      }

      if (options?.omitPhoto) {
        // Photo content is omitted from the SVG so svg2pdf never attempts to decode/render raster images,
        // leaving the photo box ready for direct 100% reliable jsPDF.addImage stream placement.
        fieldsSvg += `
          <g id="${prefix}_photo_group">
            <rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" rx="${radius.toFixed(1)}" ry="${radius.toFixed(1)}" fill="#f1f5f9" />
            ${borderSvg}
          </g>
        `;
        continue;
      }

      fieldsSvg += `
        <g id="${prefix}_photo_group">
          <rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" rx="${radius.toFixed(1)}" ry="${radius.toFixed(1)}" fill="#f1f5f9" />
          ${photoContentSvg}
          ${borderSvg}
        </g>
      `;
      continue;
    }

    if (key === 'barcode') {
      const bw = ((field.width || 38) / 100) * W;
      const bh = ((field.height || 10) / 100) * H;
      fieldsSvg += renderSimulatedBarcodeSvg(px, py, bw, bh, student.studentNumber, field.color || '#0f172a');
      continue;
    }

    // Text fields
    let rawValue = '';
    if (key === 'fullName') rawValue = student.fullName || 'Adı Soyadı';
    else if (key === 'studentNumber') rawValue = student.studentNumber || '0000';
    else if (key === 'className') rawValue = student.fieldOfStudy || student.className || '-';
    else if (key === 'schoolName') rawValue = student.schoolName || template.defaultSchoolName;
    else if (key === 'academicYear') rawValue = student.academicYear || template.defaultAcademicYear;
    else if (key === 'cardTitle') rawValue = (template.cardTitleText || 'ÖĞRENCİ KİMLİK KARTI').toLocaleUpperCase('tr-TR');

    const textAnchor = field.align === 'center' ? 'middle' : field.align === 'right' ? 'end' : 'start';
    let valueOffsetY = py;
    let prefixSvg = '';
    if (field.showPrefix && field.prefixText) {
      const labelFontSize = Math.max(12, Math.round(field.fontSize * 0.56));
      const prefixBaselineY = py + Math.round(labelFontSize * 0.78);
      prefixSvg = `<text x="${px.toFixed(1)}" y="${prefixBaselineY.toFixed(1)}" font-family="${SVG_FONT_FAMILY}" font-size="${labelFontSize}" font-weight="bold" fill="#64748b" text-anchor="${textAnchor}">${escapeXml(field.prefixText.toLocaleUpperCase('tr-TR'))}</text>`;
      valueOffsetY = py + labelFontSize + 4;
    }

    const isNumeric = key === 'studentNumber';
    const fontFamily = isNumeric ? "'IBM Plex Mono', 'Courier New', monospace" : SVG_FONT_FAMILY;

    let lines: string[] = [];
    if (key === 'schoolName') {
      const parts = rawValue.split(/\r?\n|\s*\|\s*|\s*\/\s*/).map((l) => l.trim()).filter(Boolean);
      lines = parts.length > 0 ? parts : [rawValue];
    } else if (key === 'className') {
      const parts = rawValue.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (parts.length >= 2) {
        lines = parts.slice(0, 2);
      } else if (rawValue.includes(' - ')) {
        const p = rawValue.split(/\s*-\s*/);
        lines = [p[0], p.slice(1).join(' - ')];
      } else {
        lines = [rawValue];
      }
    } else {
      lines = rawValue.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) lines = [rawValue];
    }

    let linesSvg = '';
    lines.forEach((lineText, lineIdx) => {
      let targetFontSize = field.fontSize;
      let targetWeight = normalizeSvgFontWeight(field.fontWeight || '700');
      let lineAnchor = textAnchor;
      let linePx = px;
      let currentLineTopY = valueOffsetY + lineIdx * Math.round(targetFontSize * 1.2);

      if (key === 'schoolName') {
        if (lineIdx === 0) {
          targetFontSize = field.fontSize;
          targetWeight = lines.length > 1 ? 'bold' : normalizeSvgFontWeight(field.fontWeight || '700');
        } else {
          targetFontSize = field.secondLineFontSize ?? field.fontSize;
          targetWeight = normalizeSvgFontWeight(field.fontWeight || '700');
          lineAnchor = (field.secondLineAlign ?? field.align) === 'center' ? 'middle' : (field.secondLineAlign ?? field.align) === 'right' ? 'end' : 'start';
          const secondXPct = field.secondLineX ?? field.x;
          linePx = (secondXPct / 100) * W;
          if (lineIdx === 1 && field.secondLineYOffset) {
            currentLineTopY += field.secondLineYOffset;
          }
        }
      }

      const baselineY = currentLineTopY + Math.round(targetFontSize * 0.78);

      linesSvg += `<text x="${linePx.toFixed(1)}" y="${baselineY.toFixed(1)}" font-family="${fontFamily}" font-size="${targetFontSize}" font-weight="${targetWeight}" fill="${escapeXml(field.color || '#0f172a')}" text-anchor="${lineAnchor}">${escapeXml(lineText)}</text>`;
    });

    fieldsSvg += `<g id="${prefix}-${key}">${prefixSvg}${linesSvg}</g>`;
  }

  const innerSvg = `
    ${frontBg}
    ${bgWatermark}
    ${schoolLogo}
    ${fieldsSvg}
    ${overlayWatermark}
  `;

  if (!includeRoot) return innerSvg;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${widthMm}mm" height="${heightMm}mm" id="${prefix}">
      <defs>
        <style type="text/css">
          text { font-family: 'NotoSans', Arial, 'Segoe UI', Tahoma, 'Plus Jakarta Sans', sans-serif; }
        </style>
      </defs>
      ${innerSvg}
    </svg>
  `.trim();
}

/**
 * Builds a complete A4 Sheet (210mm x 297mm) vector SVG with 10 cards aligned in 2x5 or 3x3 grid with vector crop marks.
 * Directly importable into CorelDRAW as a print-ready plate (montaj tabakası)!
 */
export function generateA4SheetSvgString(
  students: StudentRecord[],
  template: CardTemplate,
  options?: {
    side?: 'front' | 'back';
    showCropMarks?: boolean;
    cardSpacingMm?: number;
  }
): string {
  const side = options?.side || 'front';
  const showCropMarks = options?.showCropMarks ?? true;
  const isLandscapeCard = template.orientation === 'landscape';
  const cardW = isLandscapeCard ? CARD_WIDTH_MM_LANDSCAPE : CARD_HEIGHT_MM_LANDSCAPE;
  const cardH = isLandscapeCard ? CARD_HEIGHT_MM_LANDSCAPE : CARD_WIDTH_MM_LANDSCAPE;
  const gap = options?.cardSpacingMm ?? 4;

  const cols = isLandscapeCard ? 2 : 3;
  const rows = isLandscapeCard ? 5 : 3;
  const cardsPerPage = cols * rows;

  const totalGridW = cols * cardW + (cols - 1) * gap;
  const totalGridH = rows * cardH + (rows - 1) * gap;

  const startX = (210 - totalGridW) / 2;
  const startY = (297 - totalGridH) / 2;

  const W = isLandscapeCard ? CARD_WIDTH_LANDSCAPE : CARD_HEIGHT_LANDSCAPE;
  const H = isLandscapeCard ? CARD_HEIGHT_LANDSCAPE : CARD_WIDTH_LANDSCAPE;
  const scale = cardW / W; // scale factor from canvas units (1012x638) to millimeters

  let cardsSvg = '';
  let cropMarksSvg = '';

  const slice = students.slice(0, cardsPerPage);
  slice.forEach((student, j) => {
    const col = j % cols;
    // Mirrored col for back side duplex flip
    const actualCol = side === 'back' ? cols - 1 - col : col;
    const row = Math.floor(j / cols);
    const x = startX + actualCol * (cardW + gap);
    const y = startY + row * (cardH + gap);

    const safeNum = sanitizeXmlId(student.studentNumber || `${j}`);
    const safeId = sanitizeXmlId(student.id || `std_${j}`);
    const cardContent = renderStudentCardToSvgString(student, template, {
      side,
      includeRootTag: false,
      idPrefix: `c${j}_${safeNum}_${safeId}`,
    });

    cardsSvg += `
      <g id="card_${actualCol + 1}_${row + 1}_${safeNum}" transform="translate(${x.toFixed(2)}, ${y.toFixed(2)}) scale(${scale.toFixed(6)})">
        ${cardContent}
      </g>
    `;

    if (showCropMarks) {
      const tick = 2.2;
      cropMarksSvg += `
        <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cardW.toFixed(2)}" height="${cardH.toFixed(2)}" fill="none" stroke="#b4becd" stroke-width="0.2" />
        <line x1="${(x - tick).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x - 0.5).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#64748b" stroke-width="0.25" />
        <line x1="${x.toFixed(2)}" y1="${(y - tick).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y - 0.5).toFixed(2)}" stroke="#64748b" stroke-width="0.25" />
        <line x1="${(x + cardW + 0.5).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + cardW + tick).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#64748b" stroke-width="0.25" />
        <line x1="${(x + cardW).toFixed(2)}" y1="${(y - tick).toFixed(2)}" x2="${(x + cardW).toFixed(2)}" y2="${(y - 0.5).toFixed(2)}" stroke="#64748b" stroke-width="0.25" />
        <line x1="${(x - tick).toFixed(2)}" y1="${(y + cardH).toFixed(2)}" x2="${(x - 0.5).toFixed(2)}" y2="${(y + cardH).toFixed(2)}" stroke="#64748b" stroke-width="0.25" />
        <line x1="${x.toFixed(2)}" y1="${(y + cardH + 0.5).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + cardH + tick).toFixed(2)}" stroke="#64748b" stroke-width="0.25" />
        <line x1="${(x + cardW + 0.5).toFixed(2)}" y1="${(y + cardH).toFixed(2)}" x2="${(x + cardW + tick).toFixed(2)}" y2="${(y + cardH).toFixed(2)}" stroke="#64748b" stroke-width="0.25" />
        <line x1="${(x + cardW).toFixed(2)}" y1="${(y + cardH + 0.5).toFixed(2)}" x2="${(x + cardW).toFixed(2)}" y2="${(y + cardH + tick).toFixed(2)}" stroke="#64748b" stroke-width="0.25" />
      `;
    }
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 210 297" width="210mm" height="297mm">
      <defs>
        <style type="text/css">
          text { font-family: 'NotoSans', Arial, 'Segoe UI', Tahoma, 'Plus Jakarta Sans', sans-serif; }
        </style>
      </defs>
      <g id="a4-sheet-background">
        <rect width="210" height="297" fill="#ffffff" />
      </g>
      <g id="cards-grid">
        ${cardsSvg}
      </g>
      <g id="crop-marks">
        ${cropMarksSvg}
      </g>
    </svg>
  `.trim();
}

/**
 * Creates a comprehensive CorelDRAW export ZIP containing:
 * - Individual CR80 .SVG vector card files
 * - A4 Montage .SVG sheet(s)
 * - Quick README guide for CorelDRAW import
 */
export async function exportCorelDrawZip(
  students: StudentRecord[],
  template: CardTemplate,
  includeBack: boolean
): Promise<Blob> {
  const zip = new JSZip();

  // 1. Individual Cards Folder
  const cardsFolder = zip.folder('Tekli_Kartlar_CR80_SVG');
  students.forEach((s, idx) => {
    const safeNum = sanitizeXmlId(s.studentNumber || `${idx + 1}`);
    const safeName = (s.fullName || 'Ogrenci').replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_');
    const safeId = sanitizeXmlId(s.id || `std_${idx}`);
    const baseName = `${safeNum}_${safeName}`;

    const frontSvg = renderStudentCardToSvgString(s, template, {
      side: 'front',
      idPrefix: `single_${safeId}_${safeNum}_front`,
    });
    cardsFolder?.file(`${baseName}_On.svg`, frontSvg);

    if (includeBack) {
      const backSvg = renderStudentCardToSvgString(s, template, {
        side: 'back',
        idPrefix: `single_${safeId}_${safeNum}_back`,
      });
      cardsFolder?.file(`${baseName}_Arka.svg`, backSvg);
    }
  });

  // 2. A4 Montage Print Sheets (for CorelDRAW)
  const a4Folder = zip.folder('A4_Baski_Montaj_SVG');
  const isLandscape = template.orientation === 'landscape';
  const cardsPerSheet = isLandscape ? 10 : 9;
  const totalSheets = Math.ceil(students.length / cardsPerSheet);

  for (let sh = 0; sh < totalSheets; sh++) {
    const chunk = students.slice(sh * cardsPerSheet, (sh + 1) * cardsPerSheet);
    const frontA4 = generateA4SheetSvgString(chunk, template, { side: 'front' });
    a4Folder?.file(`A4_Tabaka_${sh + 1}_On.svg`, frontA4);

    if (includeBack) {
      const backA4 = generateA4SheetSvgString(chunk, template, { side: 'back' });
      a4Folder?.file(`A4_Tabaka_${sh + 1}_Arka.svg`, backA4);
    }
  }

  // 3. Matbaa / CorelDRAW Bilgi Dosyası
  const readme = `
======================================================================
T.C. MİLLÎ EĞİTİM BAKANLIĞI / OKUL KİMLİK SİSTEMİ
CORELDRAW VE MATBAA BASKI PAKETİ
======================================================================

Bu arşivdeki tüm dosyalar 100% Vektörel SVG formatında hazırlanmıştır.
Kimlik üzerindeki metinler, şeritler, çizgiler ve barkodlar resim (JPEG)
değil, bağımsız VEKTÖREL çizim ve font katmanlarıdır.

CORELDRAW İLE AÇMA VE BASKI KILAVUZU:
1. CorelDRAW programını açın (CorelDRAW X7, 2019, 2021, 2024 ve tüm sürümler).
2. "Dosya -> Aç" (Ctrl+O) veya "İçe Aktar" (Ctrl+I) ile .svg dosyasını seçin.
3. "A4_Baski_Montaj_SVG" klasöründeki dosyalar 210 x 297 mm A4 montajlı ve
   kesim kılavuzlu (crop marks) olarak doğrudan baskıya hazırdır.
4. "Tekli_Kartlar_CR80_SVG" klasöründeki dosyalar standart 85.6 x 54 mm
   CR80 PVC kart ebatlarındadır.
5. Matbaanız yazıları eğrilere (Curves) çevirmek isterse:
   CorelDRAW'da Tümünü Seç (Ctrl+A) -> Eğrilere Dönüştür (Ctrl+Q) yapabilirsiniz.

Tarih: ${new Date().toLocaleDateString('tr-TR')}
Toplam Öğrenci: ${students.length}
======================================================================
  `.trim();

  zip.file('CORELDRAW_KULLANIM_KILAVUZU.txt', readme);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Triggers a direct browser file download
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
