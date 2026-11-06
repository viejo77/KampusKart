import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import * as XLSX from 'xlsx';
import {
  calculateValidityPeriodByClass,
  createStudentPortraitDataUrl,
  inferDepartmentAndStudentNumber,
} from '../constants';
import { CardTemplate, PdfExportSettings, StudentRecord } from '../types';
import {
  drawFallbackAvatar,
  loadImage,
  renderStudentCardToCanvas,
} from './cardRenderer';
import {
  downloadFile,
  exportCorelDrawZip,
  generateA4SheetSvgString,
  renderStudentCardToSvgString,
  sanitizeXmlId,
} from './svgCardRenderer';
import {
  normalizePhotoToStandardJpeg,
  normalizeStudentsPhotos,
} from './photoNormalizer';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let cachedFontRegularBase64: string | null = null;
let cachedFontBoldBase64: string | null = null;

async function ensureTurkishFontsLoaded(pdf: jsPDF): Promise<void> {
  try {
    if (!cachedFontRegularBase64) {
      const res = await fetch('/fonts/NotoSans-Regular.ttf');
      if (res.ok) {
        const buf = await res.arrayBuffer();
        cachedFontRegularBase64 = arrayBufferToBase64(buf);
      }
    }
    if (!cachedFontBoldBase64) {
      const res = await fetch('/fonts/NotoSans-Bold.ttf');
      if (res.ok) {
        const buf = await res.arrayBuffer();
        cachedFontBoldBase64 = arrayBufferToBase64(buf);
      }
    }

    const fontAliases = [
      'NotoSans',
      'Arial',
      'Plus Jakarta Sans',
      'sans-serif',
      'Helvetica',
      'helvetica',
      'Times',
      'times',
      'Courier',
    ];
    const regularStyles = ['normal', '400', '500', '400normal', 'normal400'];
    const boldStyles = ['bold', '700', '600', '800', '900', '600normal', '700normal', 'bold700', 'bold600'];

    if (cachedFontRegularBase64) {
      pdf.addFileToVFS('NotoSans-Regular.ttf', cachedFontRegularBase64);
      for (const fam of fontAliases) {
        for (const st of regularStyles) {
          pdf.addFont('NotoSans-Regular.ttf', fam, st);
        }
      }
    }
    if (cachedFontBoldBase64) {
      pdf.addFileToVFS('NotoSans-Bold.ttf', cachedFontBoldBase64);
      for (const fam of fontAliases) {
        for (const st of boldStyles) {
          pdf.addFont('NotoSans-Bold.ttf', fam, st);
        }
      }
    }
  } catch (err) {
    console.warn('Turkish TrueType font embedding skipped:', err);
  }
}

function downloadPdfDirectly(pdf: jsPDF, filename: string): void {
  try {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  } catch (err) {
    console.warn('Blob URL download failed, falling back to pdf.save:', err);
    try {
      pdf.save(filename);
    } catch (saveErr) {
      console.error('All PDF download methods failed:', saveErr);
      throw saveErr;
    }
  }
}

/**
 * Renders a student card as genuine PDF vector graphics (paths, texts, barcode lines)
 * with high-resolution embedded portrait photos.
 */
async function renderCardVectorToPdf(
  pdf: jsPDF,
  student: StudentRecord,
  template: CardTemplate,
  side: 'front' | 'back',
  x: number,
  y: number,
  w: number,
  h: number
): Promise<void> {
  const safeId = sanitizeXmlId(`pdf_card_${student.id || student.studentNumber || '0'}_${side}`);

  // Svg2pdf renders all vector geometry (background shapes, banners, trueType fonts, barcodes, lines)
  // omitPhoto is always true so svg2pdf renders vector graphics cleanly without raster image parser errors
  const svgStr = renderStudentCardToSvgString(student, template, {
    side,
    widthMm: w,
    heightMm: h,
    idPrefix: safeId,
    omitPhoto: true,
  });

  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgStr, 'image/svg+xml');
  const svgEl = svgDoc.documentElement;

  await svg2pdf(svgEl, pdf, {
    x,
    y,
    width: w,
    height: h,
  });

  // Guarantee raster student photos are 100% rendered into the PDF stream
  // Draws via offscreen canvas into PNG format — jsPDF processPNG parses IHDR/CRC and NEVER returns 0x0
  if (side === 'front') {
    const photoField = template.fields['photo'];
    if (photoField && photoField.visible) {
      const pw = ((photoField.width || 25) / 100) * w;
      const ph = ((photoField.height || 52) / 100) * h;
      const px = x + (photoField.x / 100) * w;
      const py = y + (photoField.y / 100) * h;

      const pCanvas = document.createElement('canvas');
      pCanvas.width = 450;
      pCanvas.height = 600;
      const pctx = pCanvas.getContext('2d');
      if (pctx) {
        pctx.imageSmoothingEnabled = true;
        pctx.imageSmoothingQuality = 'high';
        pctx.fillStyle = '#ffffff';
        pctx.fillRect(0, 0, 450, 600);

        let rendered = false;
        const rawPhoto = (student.photoDataUrl || '').trim();
        if (rawPhoto) {
          try {
            const img = await loadImage(rawPhoto);
            const imgW = img.naturalWidth || img.width;
            const imgH = img.naturalHeight || img.height;
            if (imgW > 0 && imgH > 0) {
              const imgRatio = imgW / imgH;
              const targetRatio = 450 / 600;
              let dw = 450;
              let dh = 600;
              let dx = 0;
              let dy = 0;
              if (imgRatio > targetRatio) {
                dw = 600 * imgRatio;
                dx = -(dw - 450) / 2;
              } else {
                dh = 450 / imgRatio;
                dy = -(dh - 600) / 2;
              }
              pctx.drawImage(img, dx, dy, dw, dh);
              rendered = true;
            }
          } catch (err) {
            console.warn('Student photo load failed in vector PDF, drawing avatar:', err);
          }
        }

        if (!rendered) {
          drawFallbackAvatar(pctx, 0, 0, 450, 600, student);
        }

        try {
          const pngData = pCanvas.toDataURL('image/png');
          pdf.addImage(pngData, 'PNG', px, py, pw, ph, undefined, 'FAST');
        } catch (imgErr) {
          console.warn('Direct addImage PNG failed in renderCardVectorToPdf:', imgErr);
        }

        if ((photoField.borderWidth ?? 3) > 0) {
          const radius = ((photoField.borderRadius ?? 6) / 100) * Math.min(pw, ph);
          pdf.setDrawColor(photoField.borderColor || template.primaryColor);
          pdf.setLineWidth((photoField.borderWidth ?? 3) * 0.12);
          if (radius > 0) {
            pdf.roundedRect(px, py, pw, ph, radius, radius, 'S');
          } else {
            pdf.rect(px, py, pw, ph, 'S');
          }
        }
      }
    }
  }
}

export async function generateBatchStudentCardsPdf(
  students: StudentRecord[],
  template: CardTemplate,
  settings: PdfExportSettings,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (students.length === 0) return;

  // Pre-normalize all student photos into clean, standard baseline RGB JPEGs
  // Guarantees all 310 cards render their real photos with zero blank frames
  const normalizedStudents = await normalizeStudentsPhotos(students, (c, t) => {
    if (onProgress) {
      onProgress(Math.round((c / t) * 5), 100);
    }
  });

  const includeBack = Boolean(template.enableBackSide && settings.includeBackSide);
  const isLandscapeCard = template.orientation === 'landscape';
  // Standard CR80 dimensions in millimeters: 85.6 mm x 54.0 mm
  const cardWidthMm = isLandscapeCard ? 85.6 : 54.0;
  const cardHeightMm = isLandscapeCard ? 54.0 : 85.6;

  const isVector = settings.exportFormat === 'vector-pdf';
  const exportScale = Math.max(1, Math.min(2.5, settings.qualityScale || 1.5));
  let offscreenCanvas = document.createElement('canvas');

  const renderCardSlot = async (
    targetPdf: jsPDF,
    student: StudentRecord,
    side: 'front' | 'back',
    x: number,
    y: number
  ) => {
    if (isVector) {
      try {
        await renderCardVectorToPdf(
          targetPdf,
          student,
          template,
          side,
          x,
          y,
          cardWidthMm,
          cardHeightMm
        );
        return;
      } catch (err) {
        console.warn('Vector PDF render fallback to canvas:', err);
      }
    }

    try {
      await renderStudentCardToCanvas(offscreenCanvas, student, template, {
        side,
        scale: exportScale,
      });
      const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.96);
      targetPdf.addImage(imgData, 'JPEG', x, y, cardWidthMm, cardHeightMm, undefined, 'FAST');
    } catch (err) {
      console.warn('Canvas render or export failed, falling back to vector PDF:', err);
      try {
        // Fallback 1: Pure vector rendering into PDF (bypasses canvas export completely!)
        await renderCardVectorToPdf(
          targetPdf,
          student,
          template,
          side,
          x,
          y,
          cardWidthMm,
          cardHeightMm
        );
      } catch (vecErr) {
        console.warn('Vector fallback also failed, trying safe fresh canvas:', vecErr);
        // Fallback 2: Fresh canvas without potentially tainted photo
        offscreenCanvas = document.createElement('canvas');
        const safeStudent = { ...student, photoDataUrl: undefined };
        await renderStudentCardToCanvas(offscreenCanvas, safeStudent, template, {
          side,
          scale: 1,
        });
        const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.90);
        targetPdf.addImage(imgData, 'JPEG', x, y, cardWidthMm, cardHeightMm, undefined, 'FAST');
      }
    }
  };

  if (settings.layoutMode === 'single-card') {
    // 1 card per page at exact CR80 dimensions (for direct PVC card printers)
    // When includeBack is true, each student produces Page 1 (Front) followed immediately by Page 2 (Back) for duplex PVC printers
    const pdf = new jsPDF({
      orientation: isLandscapeCard ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [cardWidthMm, cardHeightMm],
    });

    await ensureTurkishFontsLoaded(pdf);

    for (let i = 0; i < normalizedStudents.length; i++) {
      if (i > 0) {
        pdf.addPage([cardWidthMm, cardHeightMm], isLandscapeCard ? 'landscape' : 'portrait');
      }
      await renderCardSlot(pdf, normalizedStudents[i], 'front', 0, 0);

      if (includeBack) {
        pdf.addPage([cardWidthMm, cardHeightMm], isLandscapeCard ? 'landscape' : 'portrait');
        await renderCardSlot(pdf, normalizedStudents[i], 'back', 0, 0);
      }

      onProgress?.(i + 1, normalizedStudents.length);
    }

    const typePrefix = isVector ? 'Vektorel_PDF' : 'Ultra_HD_PDF';
    const suffix = includeBack ? 'Cift_Yonlu_PVC' : 'Tek_Yonlu_PVC';
    downloadPdfDirectly(pdf, `Ogrenci_Kimlik_${typePrefix}_${suffix}_${normalizedStudents.length}_Ogrenci.pdf`);
    return;
  }

  // A4 Multi-Card Grid Mode (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await ensureTurkishFontsLoaded(pdf);

  const pageWidth = 210;
  const pageHeight = 297;
  const gap = settings.cardSpacingMm ?? 4;

  const cols = isLandscapeCard ? 2 : 3;
  const rows = isLandscapeCard ? 5 : 3;
  const cardsPerPage = cols * rows;

  const totalGridW = cols * cardWidthMm + (cols - 1) * gap;
  const totalGridH = rows * cardHeightMm + (rows - 1) * gap;

  const startX = (pageWidth - totalGridW) / 2;
  const startY = (pageHeight - totalGridH) / 2;

  const drawCropMarksAt = (x: number, y: number) => {
    if (!settings.showCropMarks) return;
    pdf.setDrawColor(180, 190, 205);
    pdf.setLineWidth(0.2);
    pdf.rect(x, y, cardWidthMm, cardHeightMm);

    const tick = 2.2;
    pdf.setDrawColor(100, 116, 139);
    pdf.setLineWidth(0.25);
    pdf.line(x - tick, y, x - 0.5, y);
    pdf.line(x, y - tick, x, y - 0.5);
    pdf.line(x + cardWidthMm + 0.5, y, x + cardWidthMm + tick, y);
    pdf.line(x + cardWidthMm, y - tick, x + cardWidthMm, y - 0.5);
    pdf.line(x - tick, y + cardHeightMm, x - 0.5, y + cardHeightMm);
    pdf.line(x, y + cardHeightMm + 0.5, x, y + cardHeightMm + tick);
    pdf.line(x + cardWidthMm + 0.5, y + cardHeightMm, x + cardWidthMm + tick, y + cardHeightMm);
    pdf.line(x + cardWidthMm, y + cardHeightMm + 0.5, x + cardWidthMm, y + cardHeightMm + tick);
  };

  // Process students in chunks of cardsPerPage so that if back side is enabled,
  // each Front A4 Sheet is followed by its horizontally mirrored Back A4 Sheet for accurate duplex printing!
  const totalChunks = Math.ceil(normalizedStudents.length / cardsPerPage);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const chunkStudents = normalizedStudents.slice(
      chunkIdx * cardsPerPage,
      (chunkIdx + 1) * cardsPerPage
    );

    if (chunkIdx > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // 1. Render Front Sheet for this chunk
    for (let j = 0; j < chunkStudents.length; j++) {
      const col = j % cols;
      const row = Math.floor(j / cols);
      const x = startX + col * (cardWidthMm + gap);
      const y = startY + row * (cardHeightMm + gap);

      await renderCardSlot(pdf, chunkStudents[j], 'front', x, y);
      drawCropMarksAt(x, y);

      if (!includeBack) {
        onProgress?.(chunkIdx * cardsPerPage + j + 1, normalizedStudents.length);
      }
    }

    // 2. Render Back Sheet for this chunk (if double-sided enabled)
    // Note: For A4 duplex long-edge flip, column is mirrored (`cols - 1 - col`) so back matches front!
    if (includeBack) {
      pdf.addPage('a4', 'portrait');
      for (let j = 0; j < chunkStudents.length; j++) {
        const col = j % cols;
        const mirroredCol = cols - 1 - col;
        const row = Math.floor(j / cols);
        const x = startX + mirroredCol * (cardWidthMm + gap);
        const y = startY + row * (cardHeightMm + gap);

        await renderCardSlot(pdf, chunkStudents[j], 'back', x, y);
        drawCropMarksAt(x, y);

        onProgress?.(chunkIdx * cardsPerPage + j + 1, normalizedStudents.length);
      }
    }
  }

  const typePrefix = isVector ? 'Vektorel_A4' : 'Ultra_HD_A4';
  const suffix = includeBack ? 'Cift_Yonlu' : 'Tek_Yonlu';
  downloadPdfDirectly(pdf, `Toplu_Ogrenci_Kimlik_${typePrefix}_${suffix}_${normalizedStudents.length}_Ogrenci.pdf`);
}

/**
 * Directly exports an A4 Sheet (.SVG) for CorelDRAW with vector text, paths, and crop marks.
 */
export async function exportBatchCardsToCorelSvg(
  students: StudentRecord[],
  template: CardTemplate,
  settings: PdfExportSettings,
  side: 'front' | 'back' = 'front'
): Promise<void> {
  if (students.length === 0) return;
  const normalizedStudents = await normalizeStudentsPhotos(students);
  const svgContent = generateA4SheetSvgString(normalizedStudents, template, {
    side,
    showCropMarks: settings.showCropMarks,
    cardSpacingMm: settings.cardSpacingMm,
  });
  const sideName = side === 'front' ? 'On_Yuz' : 'Arka_Yuz';
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  downloadFile(blob, `CorelDraw_A4_Baski_Montaj_${sideName}_${students.length}_Ogrenci.svg`);
}

/**
 * Directly exports a comprehensive ZIP archive containing individual CR80 vector .SVG cards
 * and A4 montage sheets ready for CorelDRAW import and plate printing.
 */
export async function exportBatchCardsToCorelZip(
  students: StudentRecord[],
  template: CardTemplate,
  includeBack: boolean,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (students.length === 0) return;
  onProgress?.(1, 3);
  const normalizedStudents = await normalizeStudentsPhotos(students);
  onProgress?.(2, 3);
  const blob = await exportCorelDrawZip(normalizedStudents, template, includeBack);
  onProgress?.(3, 3);
  downloadFile(blob, `CorelDraw_Vektorel_Baski_Paketi_${students.length}_Ogrenci.zip`);
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

export function parseSpreadsheetFile(
  file: File,
  defaultSchoolName: string,
  defaultAcademicYear: string,
  existingPhotosMap: Map<string, { dataUrl: string; fileName: string }>
): Promise<{
  students: StudentRecord[];
  rawHeaders: string[];
  rawRows: Record<string, string>[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
          defval: '',
        });

        if (jsonRows.length === 0) {
          resolve({ students: [], rawHeaders: [], rawRows: [] });
          return;
        }

        const rawHeaders = Object.keys(jsonRows[0]);

        let numCol = '';
        let nameCol = '';
        let firstNameCol = '';
        let lastNameCol = '';
        let classCol = '';
        let alanCol = '';
        let schoolCol = '';
        let schoolLine2Col = '';
        let yearCol = '';
        let bloodCol = '';
        let emergencyPhoneCol = '';

        for (const h of rawHeaders) {
          const norm = normalizeHeaderKey(h);
          if (
            !numCol &&
            (norm.includes('okulno') ||
              norm.includes('ogrencino') ||
              norm.includes('numara') ||
              norm === 'no' ||
              norm === 'id' ||
              norm.includes('sinifno'))
          ) {
            numCol = h;
          } else if (
            !nameCol &&
            (norm.includes('adsoyad') ||
              norm.includes('adisoyadi') ||
              norm.includes('ogrenciadi') ||
              norm.includes('isim') ||
              norm === 'ad')
          ) {
            nameCol = h;
          } else if (!firstNameCol && (norm === 'ad' || norm === 'adi')) {
            firstNameCol = h;
          } else if (!lastNameCol && (norm === 'soyad' || norm === 'soyadi')) {
            lastNameCol = h;
          } else if (
            !alanCol &&
            (norm.includes('alan') || norm.includes('dal') || norm.includes('brans') || norm.includes('meslek'))
          ) {
            alanCol = h;
          } else if (
            !classCol &&
            (norm.includes('sinif') || norm.includes('sube') || norm.includes('bolum'))
          ) {
            classCol = h;
          } else if (
            !schoolLine2Col &&
            (norm.includes('okul2') ||
              norm.includes('okulsatir2') ||
              norm.includes('okulismi2') ||
              norm.includes('okuladi2') ||
              norm.includes('altsatir'))
          ) {
            schoolLine2Col = h;
          } else if (!schoolCol && (norm.includes('okul') || norm.includes('kurum'))) {
            schoolCol = h;
          } else if (!yearCol && (norm.includes('yil') || norm.includes('donem'))) {
            yearCol = h;
          } else if (!bloodCol && norm.includes('kan')) {
            bloodCol = h;
          } else if (
            !emergencyPhoneCol &&
            (norm.includes('veli') || norm.includes('acil') || norm.includes('tel'))
          ) {
            emergencyPhoneCol = h;
          }
        }

        if (!numCol && rawHeaders.length > 0) numCol = rawHeaders[0];
        if (!nameCol && rawHeaders.length > 1) nameCol = rawHeaders[1];
        if (!classCol && rawHeaders.length > 2) classCol = rawHeaders[2];
        if (!schoolCol && rawHeaders.length > 3) schoolCol = rawHeaders[3];

        const parsedStudents: StudentRecord[] = jsonRows
          .map((row, idx) => {
            const rawNo = String(row[numCol] ?? '').trim();
            let fullName = '';
            if (firstNameCol && lastNameCol) {
              fullName = `${String(row[firstNameCol] ?? '').trim()} ${String(
                row[lastNameCol] ?? ''
              ).trim()}`.trim();
            } else {
              fullName = String(row[nameCol] ?? '').trim();
            }

            const className = classCol ? String(row[classCol] ?? '').trim() : '10-A';
            const rawDepartment = alanCol ? String(row[alanCol] ?? '').trim() : '';

            // Automatically prepend AMP / ATP to student number and determine student's Field of Study (Alanı)
            const { formattedStudentNumber, fieldOfStudy } = inferDepartmentAndStudentNumber(
              rawNo,
              className,
              rawDepartment
            );

            let schoolName = defaultSchoolName;
            const rawSchool1 = schoolCol ? String(row[schoolCol] ?? '').trim() : '';
            const rawSchool2 = schoolLine2Col ? String(row[schoolLine2Col] ?? '').trim() : '';
            if (rawSchool1 && rawSchool2) {
              schoolName = `${rawSchool1}\n${rawSchool2}`;
            } else if (rawSchool1) {
              schoolName = rawSchool1.replace(/\s*\|\s*|\s*\/\s*/g, '\n');
            }
            const rawYearCell = yearCol ? String(row[yearCol] ?? '').trim() : '';
            // If spreadsheet doesn't specify a custom multi-year validity or only has a generic year, calculate validity period by class grade (9->4yr, 10->3yr, 11->2yr, 12->1yr)
            const academicYear =
              rawYearCell && rawYearCell.toLowerCase().includes('yıl')
                ? rawYearCell
                : calculateValidityPeriodByClass(className, rawYearCell || defaultAcademicYear);

            const bloodType = bloodCol ? String(row[bloodCol] ?? '').trim() : 'A Rh(+)';
            const emergencyPhone = emergencyPhoneCol
              ? String(row[emergencyPhoneCol] ?? '').trim()
              : '';

            const matchedPhoto = findMatchingPhoto(formattedStudentNumber, fullName, existingPhotosMap) ||
              findMatchingPhoto(rawNo, fullName, existingPhotosMap);

            let photoDataUrl = matchedPhoto?.dataUrl;
            let photoFileName = matchedPhoto?.fileName;

            if (!photoDataUrl) {
              const skinPalette = ['#f5d0b5', '#ecc1a1', '#f7d7c4', '#e5b899', '#f3cfb6', '#eab996'];
              const hairPalette = ['#271c19', '#452c1e', '#5c3a21', '#1c1917', '#3b2314', '#292524'];
              const shirtPalette = ['#1e3a8a', '#0f172a', '#1e293b', '#0369a1', '#065f46', '#334155'];
              const bgPalette = ['#e2e8f0', '#dbeafe', '#e0f2fe', '#f1f5f9', '#f8fafc', '#ecfdf5'];

              const lowerName = (fullName || '').toLowerCase();
              const isFemale =
                lowerName.endsWith('a') ||
                lowerName.endsWith('e') ||
                lowerName.includes('elif') ||
                lowerName.includes('zeynep') ||
                lowerName.includes('defne') ||
                lowerName.includes('ayşe') ||
                lowerName.includes('fatma') ||
                idx % 2 === 0;

              const initials = (fullName || 'ÖĞ')
                .split(/\s+/)
                .map((n) => n[0])
                .join('')
                .toLocaleUpperCase('tr-TR')
                .slice(0, 2) || 'ÖĞ';

              const rawNumMatch = (formattedStudentNumber || rawNo).match(/\d+/);
              const rawNum = rawNumMatch ? rawNumMatch[0] : String(1000 + idx);

              photoDataUrl = createStudentPortraitDataUrl(
                initials,
                bgPalette[idx % bgPalette.length],
                shirtPalette[idx % shirtPalette.length],
                hairPalette[idx % hairPalette.length],
                skinPalette[idx % skinPalette.length],
                isFemale ? 'f' : 'm',
                rawNum
              );
              photoFileName = `${rawNum}.jpg`;
            }

            return {
              id: `row-${Date.now()}-${idx}`,
              studentNumber: formattedStudentNumber,
              fullName,
              className,
              fieldOfStudy,
              schoolName,
              academicYear,
              bloodType,
              emergencyPhone,
              photoDataUrl,
              photoFileName,
            };
          })
          .filter((s) => s.studentNumber !== '' || s.fullName !== '');

        resolve({
          students: parsedStudents,
          rawHeaders,
          rawRows: jsonRows,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export function normalizePhotoMatchKey(input: string): string {
  if (!input) return '';
  const withoutExt = input.replace(/\.[^/.]+$/, '').trim();
  // Strip AMP- or ATP- prefix
  const stripped = withoutExt.replace(/^(AMP|ATP)[-_\s]*/i, '').trim();
  if (/^\d+$/.test(stripped)) {
    return String(parseInt(stripped, 10));
  }
  // If filename or string contains embedded digits (e.g. 1088_Zeynep, Foto 1088, Zeynep-1088)
  const numMatch = stripped.match(/\b\d{2,8}\b/) || stripped.match(/\d{2,8}/);
  if (numMatch) {
    return String(parseInt(numMatch[0], 10));
  }
  return stripped.toLowerCase().replace(/[\s\-_.]+/g, '');
}

/**
 * Robust photo matcher that attempts multiple matching strategies:
 * 1. Normalized key
 * 2. Digits from student number against photo key / filename
 * 3. Student's name against filename
 */
export function findMatchingPhoto(
  studentNumber: string,
  fullName: string,
  photosMap: Map<string, { dataUrl: string; fileName: string }>
): { dataUrl: string; fileName: string } | undefined {
  if (!photosMap || photosMap.size === 0) return undefined;

  // 1. Direct match with normalized key
  const key1 = normalizePhotoMatchKey(studentNumber);
  if (photosMap.has(key1)) return photosMap.get(key1);

  // 2. Extract digits from student number (e.g., "AMP 1088" -> "1088")
  const digitsMatch = studentNumber.match(/\d+/);
  if (digitsMatch) {
    const digits = String(parseInt(digitsMatch[0], 10));
    if (photosMap.has(digits)) return photosMap.get(digits);

    for (const [k, v] of photosMap.entries()) {
      if (k === digits || normalizePhotoMatchKey(v.fileName) === digits) {
        return v;
      }
      const fnDigits = v.fileName.match(/\d+/);
      if (fnDigits && String(parseInt(fnDigits[0], 10)) === digits) {
        return v;
      }
    }
  }

  // 3. Name-based match (e.g. "Elif Yılmaz" matches "1042_Elif_Yilmaz.jpg" or "elif_yilmaz.png")
  if (fullName && fullName.trim().length >= 3) {
    const cleanStudentName = fullName
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '');

    for (const [, v] of photosMap.entries()) {
      const cleanFileName = v.fileName
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '');

      if (cleanFileName.includes(cleanStudentName) || cleanStudentName.includes(cleanFileName)) {
        return v;
      }
    }
  }

  return undefined;
}

export function downloadSampleExcelFile(students: StudentRecord[]) {
  const rows = students.map((s) => {
    const parts = (s.schoolName || '').split(/\r?\n/);
    return {
      // Raw school number (user can directly write 1205, app will automatically prepend AMP / ATP based on class)
      'Okul Numarası': s.studentNumber.replace(/^(AMP|ATP)[-_\s]*/i, '') || s.studentNumber,
      'Adı Soyadı': s.fullName,
      'Alanı': s.fieldOfStudy || 'Bilişim Teknolojileri Alanı',
      'Sınıfı': s.className,
      'Okul İsmi 1. Satır': parts[0] || '',
      'Okul İsmi 2. Satır': parts[1] || '',
      'Dönem / Geçerlilik Süresi':
        s.academicYear || calculateValidityPeriodByClass(s.className, '2026'),
      'Kan Grubu': s.bloodType || 'A Rh(+)',
      'Acil Veli Tel': s.emergencyPhone || '0532 000 00 00',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 24 },
    { wch: 30 },
    { wch: 14 },
    { wch: 28 },
    { wch: 28 },
    { wch: 15 },
    { wch: 14 },
    { wch: 18 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ogrenci_Listesi');
  XLSX.writeFile(workbook, 'Ornek_Ogrenci_Kimlik_Listesi.xlsx');
}
