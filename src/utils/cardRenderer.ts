import {
  BackFieldKey,
  CardTemplate,
  FieldKey,
  FieldPosition,
  FrontFieldKey,
  StudentRecord,
} from '../types';

// Standard CR80 at 300 DPI: 1012 x 638 px (landscape) or 638 x 1012 px (portrait)
export const CARD_WIDTH_LANDSCAPE = 1012;
export const CARD_HEIGHT_LANDSCAPE = 638;

const imageCache = new Map<string, HTMLImageElement>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url)!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawSchoolEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  primaryColor: string,
  accentColor: string
) {
  ctx.save();
  // Outer gold ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();

  // Inner circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.84, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.74, 0, Math.PI * 2);
  ctx.fillStyle = primaryColor;
  ctx.fill();

  // Stylized open book / star inside emblem
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(radius * 0.65)}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TC', cx, cy + 1);
  ctx.restore();
}

function drawSimulatedBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  studentNumber: string,
  color: string
) {
  ctx.save();
  const seedStr = `${studentNumber || '0000'}987654321`;
  const totalBars = 44;
  const barAreaWidth = w;
  const unitWidth = barAreaWidth / (totalBars * 1.65);

  ctx.fillStyle = color;
  let currentX = x;
  for (let i = 0; i < totalBars; i++) {
    const charCode = seedStr.charCodeAt(i % seedStr.length);
    const barThick = ((i + charCode) % 3) + 1;
    const gapThick = ((i * 2 + charCode) % 2) + 1;
    const bw = unitWidth * barThick * 0.72;
    if (currentX + bw <= x + w) {
      ctx.fillRect(currentX, y, bw, h * 0.78);
    }
    currentX += bw + unitWidth * gapThick * 0.55;
  }

  ctx.font = `500 ${Math.max(12, Math.round(h * 0.22))}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = color;
  ctx.fillText(`* ${studentNumber || '0000'} *`, x + w / 2, y + h + 2);
  ctx.restore();
}

function drawBuiltInThemeBackground(
  ctx: CanvasRenderingContext2D,
  template: CardTemplate,
  W: number,
  H: number
) {
  ctx.fillStyle = template.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (template.id === 'meb-classic') {
    const headerH = H * 0.235;
    ctx.fillStyle = template.primaryColor;
    ctx.fillRect(0, 0, W, headerH);

    ctx.fillStyle = template.accentColor;
    ctx.fillRect(0, headerH, W, H * 0.016);

    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = template.primaryColor;
    ctx.beginPath();
    ctx.arc(W * 0.86, H * 0.62, H * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = template.primaryColor;
    ctx.fillRect(0, H * 0.945, W, H * 0.055);
    ctx.fillStyle = template.accentColor;
    ctx.fillRect(0, H * 0.935, W, H * 0.01);

    if (!template.schoolLogoUrl) {
      drawSchoolEmblem(ctx, W * 0.11, headerH * 0.52, headerH * 0.36, template.primaryColor, template.accentColor);
    }
  } else if (template.id === 'modern-campus') {
    ctx.save();
    ctx.fillStyle = template.primaryColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H * 0.24);
    ctx.lineTo(0, H * 0.20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = template.accentColor;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.moveTo(W * 0.62, H * 0.2);
    ctx.lineTo(W, H * 0.22);
    ctx.lineTo(W, H);
    ctx.lineTo(W * 0.54, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = template.secondaryColor;
    ctx.fillRect(0, H * 0.94, W, H * 0.06);
  } else if (template.id === 'emerald-college') {
    const headerH = H * 0.23;
    ctx.fillStyle = template.primaryColor;
    ctx.fillRect(0, 0, W, headerH);

    ctx.fillStyle = template.accentColor;
    ctx.fillRect(0, headerH, W, H * 0.012);
    ctx.fillRect(0, headerH + H * 0.02, W, H * 0.005);

    ctx.strokeStyle = template.primaryColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(W * 0.025, H * 0.27, W * 0.95, H * 0.66);

    ctx.fillStyle = template.primaryColor;
    ctx.fillRect(0, H * 0.95, W, H * 0.05);

    if (!template.schoolLogoUrl) {
      drawSchoolEmblem(ctx, W * 0.1, headerH * 0.5, headerH * 0.35, template.primaryColor, template.accentColor);
    }
  } else if (template.id === 'vertical-lanyard') {
    const headerH = H * 0.30;
    ctx.fillStyle = template.primaryColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, headerH * 0.85);
    ctx.quadraticCurveTo(W * 0.5, headerH * 1.15, 0, headerH * 0.85);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    drawRoundedRect(ctx, W * 0.41, H * 0.022, W * 0.18, H * 0.018, 8);
    ctx.fill();

    ctx.fillStyle = template.secondaryColor;
    ctx.fillRect(0, H * 0.96, W, H * 0.04);
  }
}

function drawBuiltInBackBackground(
  ctx: CanvasRenderingContext2D,
  template: CardTemplate,
  W: number,
  H: number
) {
  ctx.fillStyle = template.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const isLandscape = template.orientation === 'landscape';
  const topBarH = isLandscape ? H * 0.155 : H * 0.135;

  // Institutional top band on back side
  ctx.fillStyle = template.primaryColor;
  ctx.fillRect(0, 0, W, topBarH);

  // Accent thin line
  ctx.fillStyle = template.accentColor;
  ctx.fillRect(0, topBarH, W, H * 0.012);

  // Subtle magnetic-style or institutional divider panel behind return notice
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(W * 0.04, topBarH + H * 0.03, W * 0.92, H * 0.12);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(W * 0.04, topBarH + H * 0.03, W * 0.92, H * 0.12);

  // Bottom bar
  ctx.fillStyle = template.primaryColor;
  ctx.fillRect(0, H * 0.945, W, H * 0.055);
  ctx.fillStyle = template.accentColor;
  ctx.fillRect(0, H * 0.935, W, H * 0.01);
}

function drawSignatureOrApprovalBox(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pw: number,
  ph: number,
  field: FieldPosition,
  isPrincipalBox: boolean,
  principalSignatureUrl?: string
) {
  const radius = ((field.borderRadius ?? 8) / 100) * Math.min(pw, ph);

  ctx.save();
  drawRoundedRect(ctx, px, py, pw, ph, radius);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();

  ctx.lineWidth = field.borderWidth ?? 2;
  ctx.strokeStyle = field.borderColor || '#94a3b8';
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Title at top of box
  const lines = (field.customText || (isPrincipalBox ? 'OKUL MÜDÜRÜ\nİmza / Mühür' : 'ÖĞRENCİ İMZASI'))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  ctx.font = `${field.fontWeight || '700'} ${field.fontSize || 15}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = field.color || '#334155';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  lines.forEach((line, idx) => {
    ctx.fillText(line, px + pw / 2, py + 10 + idx * (field.fontSize + 4));
  });

  // Dotted baseline for signing at bottom of box
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.15, py + ph * 0.78);
  ctx.lineTo(px + pw * 0.85, py + ph * 0.78);
  ctx.stroke();

  if (isPrincipalBox && !principalSignatureUrl) {
    // Subtle circular official seal placeholder graphic
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    const sealR = Math.min(pw, ph) * 0.24;
    ctx.beginPath();
    ctx.arc(px + pw * 0.76, py + ph * 0.58, sealR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + pw * 0.76, py + ph * 0.58, sealR * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export async function renderStudentCardToCanvas(
  canvas: HTMLCanvasElement,
  student: StudentRecord,
  template: CardTemplate,
  options?: {
    side?: 'front' | 'back';
    selectedField?: FieldKey | null;
    showInteractiveGuides?: boolean;
  }
): Promise<void> {
  const side = options?.side || 'front';
  const isLandscape = template.orientation === 'landscape';
  const W = isLandscape ? CARD_WIDTH_LANDSCAPE : CARD_HEIGHT_LANDSCAPE;
  const H = isLandscape ? CARD_HEIGHT_LANDSCAPE : CARD_WIDTH_LANDSCAPE;

  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  // ================= BACK SIDE RENDERING =================
  if (side === 'back') {
    if (template.customBackBackgroundUrl) {
      try {
        const bgImg = await loadImage(template.customBackBackgroundUrl);
        ctx.drawImage(bgImg, 0, 0, W, H);
      } catch {
        drawBuiltInBackBackground(ctx, template, W, H);
      }
    } else {
      drawBuiltInBackBackground(ctx, template, W, H);
    }

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
        drawSignatureOrApprovalBox(
          ctx,
          px,
          py,
          pw,
          ph,
          field,
          key === 'principalApproval',
          template.principalSignatureUrl
        );

        // If principal signature/stamp image is uploaded, render it inside the approval box
        if (key === 'principalApproval' && template.principalSignatureUrl) {
          try {
            const sigImg = await loadImage(template.principalSignatureUrl);
            const maxW = pw * 0.75;
            const maxH = ph * 0.55;
            ctx.drawImage(
              sigImg,
              px + (pw - maxW) / 2,
              py + ph * 0.36,
              maxW,
              maxH
            );
          } catch {
            // ignore
          }
        }

        if (options?.showInteractiveGuides && options.selectedField === key) {
          drawSelectionBox(ctx, px - 4, py - 4, pw + 8, ph + 8);
        }
        continue;
      }

      if (key === 'backBarcode') {
        const bw = ((field.width || 50) / 100) * W;
        const bh = ((field.height || 9) / 100) * H;
        drawSimulatedBarcode(ctx, px, py, bw, bh, student.studentNumber, field.color || '#0f172a');
        if (options?.showInteractiveGuides && options.selectedField === key) {
          drawSelectionBox(ctx, px - 6, py - 6, bw + 12, bh + 12);
        }
        continue;
      }

      // Text fields on Back Side
      let rawText = field.customText || '';
      if (key === 'studentInfoSummary') {
        const blood = student.bloodType || 'Belirtilmedi';
        const emergency = student.emergencyPhone || '-';
        if (rawText.includes('{bloodType}') || rawText.includes('{emergencyPhone}')) {
          rawText = rawText
            .replace('{bloodType}', blood)
            .replace('{emergencyPhone}', emergency);
        } else if (!rawText.trim()) {
          rawText = `Kan Grubu: ${blood}  ·  Acil Veli Tel: ${emergency}`;
        }
      }

      ctx.save();
      ctx.textAlign = field.align || 'left';
      ctx.textBaseline = 'top';

      let valueOffsetY = py;
      if (field.showPrefix && field.prefixText) {
        const labelFontSize = Math.max(11, Math.round(field.fontSize * 0.62));
        ctx.font = `600 ${labelFontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(field.prefixText.toUpperCase(), px, py);
        valueOffsetY = py + labelFontSize + 4;
      }

      ctx.font = `${field.fontWeight || '600'} ${field.fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = field.color || '#0f172a';

      const lines = rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const lineHeight = Math.round(field.fontSize * 1.28);
      let maxLineWidth = 100;

      lines.forEach((lineText, idx) => {
        const ly = valueOffsetY + idx * lineHeight;
        ctx.fillText(lineText, px, ly);
        const m = ctx.measureText(lineText).width;
        if (m > maxLineWidth) maxLineWidth = m;
      });

      if (options?.showInteractiveGuides && options.selectedField === key) {
        const textW = Math.max(maxLineWidth, 90);
        const totalH = (valueOffsetY - py) + Math.max(1, lines.length) * lineHeight + 6;
        let boxX = px;
        if (field.align === 'center') boxX = px - textW / 2;
        else if (field.align === 'right') boxX = px - textW;
        drawSelectionBox(ctx, boxX - 8, py - 6, textW + 16, totalH + 8);
      }

      ctx.restore();
    }
    return;
  }

  // ================= FRONT SIDE RENDERING =================
  if (template.customBackgroundUrl) {
    try {
      const bgImg = await loadImage(template.customBackgroundUrl);
      ctx.drawImage(bgImg, 0, 0, W, H);
    } catch {
      drawBuiltInThemeBackground(ctx, template, W, H);
    }
  } else {
    drawBuiltInThemeBackground(ctx, template, W, H);
  }

  if (template.schoolLogoUrl && !template.customBackgroundUrl) {
    try {
      const logoImg = await loadImage(template.schoolLogoUrl);
      const logoSize = isLandscape ? H * 0.16 : W * 0.16;
      const lx = isLandscape ? W * 0.05 : W * 0.06;
      const ly = H * 0.035;
      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    } catch {
      // ignore logo error
    }
  }

  const fieldOrder: FrontFieldKey[] = [
    'schoolName',
    'cardTitle',
    'photo',
    'fullName',
    'studentNumber',
    'className',
    'academicYear',
    'barcode',
  ];

  for (const key of fieldOrder) {
    const field: FieldPosition = template.fields[key];
    if (!field || !field.visible) continue;

    const px = (field.x / 100) * W;
    const py = (field.y / 100) * H;

    if (key === 'photo') {
      const pw = ((field.width || 25) / 100) * W;
      const ph = ((field.height || 52) / 100) * H;
      const radius = ((field.borderRadius ?? 6) / 100) * Math.min(pw, ph);

      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;
      drawRoundedRect(ctx, px, py, pw, ph, radius);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.restore();

      ctx.save();
      drawRoundedRect(ctx, px, py, pw, ph, radius);
      ctx.clip();

      if (student.photoDataUrl) {
        try {
          const photoImg = await loadImage(student.photoDataUrl);
          const imgRatio = photoImg.width / photoImg.height;
          const boxRatio = pw / ph;
          let drawW = pw;
          let drawH = ph;
          let offsetX = px;
          let offsetY = py;

          if (imgRatio > boxRatio) {
            drawW = ph * imgRatio;
            offsetX = px - (drawW - pw) / 2;
          } else {
            drawH = pw / imgRatio;
            offsetY = py - (drawH - ph) / 2;
          }
          ctx.drawImage(photoImg, offsetX, offsetY, drawW, drawH);
        } catch {
          drawFallbackAvatar(ctx, px, py, pw, ph, student);
        }
      } else {
        drawFallbackAvatar(ctx, px, py, pw, ph, student);
      }
      ctx.restore();

      if ((field.borderWidth ?? 3) > 0) {
        ctx.save();
        drawRoundedRect(ctx, px, py, pw, ph, radius);
        ctx.lineWidth = field.borderWidth ?? 3;
        ctx.strokeStyle = field.borderColor || '#0f172a';
        ctx.stroke();
        ctx.restore();
      }

      if (options?.showInteractiveGuides && options.selectedField === 'photo') {
        drawSelectionBox(ctx, px - 4, py - 4, pw + 8, ph + 8);
      }
      continue;
    }

    if (key === 'barcode') {
      const bw = ((field.width || 50) / 100) * W;
      const bh = ((field.height || 10) / 100) * H;
      drawSimulatedBarcode(ctx, px, py, bw, bh, student.studentNumber, field.color || '#0f172a');
      if (options?.showInteractiveGuides && options.selectedField === 'barcode') {
        drawSelectionBox(ctx, px - 6, py - 6, bw + 12, bh + 12);
      }
      continue;
    }

    let rawValue = '';
    if (key === 'fullName') rawValue = student.fullName || 'Adı Soyadı';
    else if (key === 'studentNumber') rawValue = student.studentNumber || '0000';
    else if (key === 'className') rawValue = student.className || '-';
    else if (key === 'schoolName') rawValue = student.schoolName || template.defaultSchoolName;
    else if (key === 'academicYear') rawValue = student.academicYear || template.defaultAcademicYear;
    else if (key === 'cardTitle') rawValue = template.cardTitleText || 'ÖĞRENCİ KİMLİK KARTI';

    ctx.save();
    ctx.textAlign = field.align || 'left';
    ctx.textBaseline = 'top';

    let valueOffsetY = py;
    if (field.showPrefix && field.prefixText) {
      const labelFontSize = Math.max(12, Math.round(field.fontSize * 0.56));
      ctx.font = `600 ${labelFontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#64748b';
      ctx.fillText(field.prefixText.toUpperCase(), px, py);
      valueOffsetY = py + labelFontSize + 5;
    }

    const isNumericField = key === 'studentNumber';
    const fontFamily = isNumericField
      ? '"IBM Plex Mono", "Plus Jakarta Sans", sans-serif'
      : '"Plus Jakarta Sans", sans-serif';

    ctx.font = `${field.fontWeight || '700'} ${field.fontSize}px ${fontFamily}`;
    ctx.fillStyle = field.color || '#0f172a';

    let lines: string[] = [];
    if (key === 'schoolName') {
      const explicitLines = rawValue
        .split(/\r?\n|\s*\|\s*|\s*\/\s*/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (explicitLines.length >= 2) {
        lines = explicitLines.slice(0, 2);
      } else {
        const maxSchoolWidth = W * 0.72;
        if (ctx.measureText(rawValue).width > maxSchoolWidth && rawValue.includes(' ')) {
          const words = rawValue.split(/\s+/);
          const mid = Math.ceil(words.length / 2);
          lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
        } else {
          lines = [rawValue];
        }
      }
    } else {
      lines = rawValue
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) lines = [rawValue];
    }

    const lineHeight = Math.round(field.fontSize * 1.22);
    let maxLineWidth = 80;

    lines.forEach((lineText, lineIdx) => {
      if (key === 'schoolName' && lines.length > 1 && lineIdx === 0) {
        const firstLineSize = Math.max(12, Math.round(field.fontSize * 0.78));
        ctx.font = `600 ${firstLineSize}px ${fontFamily}`;
      } else {
        ctx.font = `${field.fontWeight || '700'} ${field.fontSize}px ${fontFamily}`;
      }

      const lineY = valueOffsetY + lineIdx * lineHeight;
      ctx.fillText(lineText, px, lineY);
      const measured = ctx.measureText(lineText).width;
      if (measured > maxLineWidth) maxLineWidth = measured;
    });

    if (options?.showInteractiveGuides && options.selectedField === key) {
      const textW = Math.max(maxLineWidth, 80);
      const totalH = (valueOffsetY - py) + lines.length * lineHeight + 4;
      let boxX = px;
      if (field.align === 'center') boxX = px - textW / 2;
      else if (field.align === 'right') boxX = px - textW;
      drawSelectionBox(ctx, boxX - 8, py - 6, textW + 16, totalH + 8);
    }

    ctx.restore();
  }
}

function drawFallbackAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  student: StudentRecord
) {
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.36, Math.min(w, h) * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.95, Math.min(w, h) * 0.42, Math.PI, 0, false);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${student.studentNumber}.jpg`, x + w / 2, y + h * 0.88);
}

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);

  ctx.setLineDash([]);
  ctx.fillStyle = '#2563eb';
  const hs = 8;
  ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
  ctx.fillRect(x + w - hs / 2, y - hs / 2, hs, hs);
  ctx.fillRect(x - hs / 2, y + h - hs / 2, hs, hs);
  ctx.fillRect(x + w - hs / 2, y + h - hs / 2, hs, hs);
  ctx.restore();
}
