import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { CardTemplate, PdfExportSettings, StudentRecord } from '../types';
import { renderStudentCardToCanvas } from './cardRenderer';

export async function generateBatchStudentCardsPdf(
  students: StudentRecord[],
  template: CardTemplate,
  settings: PdfExportSettings,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (students.length === 0) return;

  const includeBack = Boolean(template.enableBackSide && settings.includeBackSide);
  const isLandscapeCard = template.orientation === 'landscape';
  // Standard CR80 dimensions in millimeters: 85.6 mm x 54.0 mm
  const cardWidthMm = isLandscapeCard ? 85.6 : 54.0;
  const cardHeightMm = isLandscapeCard ? 54.0 : 85.6;

  const offscreenCanvas = document.createElement('canvas');

  if (settings.layoutMode === 'single-card') {
    // 1 card per page at exact CR80 dimensions (for direct PVC card printers)
    // When includeBack is true, each student produces Page 1 (Front) followed immediately by Page 2 (Back) for duplex PVC printers
    const pdf = new jsPDF({
      orientation: isLandscapeCard ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [cardWidthMm, cardHeightMm],
    });

    for (let i = 0; i < students.length; i++) {
      if (i > 0) {
        pdf.addPage([cardWidthMm, cardHeightMm], isLandscapeCard ? 'landscape' : 'portrait');
      }
      await renderStudentCardToCanvas(offscreenCanvas, students[i], template, { side: 'front' });
      const frontImgData = offscreenCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(frontImgData, 'JPEG', 0, 0, cardWidthMm, cardHeightMm);

      if (includeBack) {
        pdf.addPage([cardWidthMm, cardHeightMm], isLandscapeCard ? 'landscape' : 'portrait');
        await renderStudentCardToCanvas(offscreenCanvas, students[i], template, { side: 'back' });
        const backImgData = offscreenCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(backImgData, 'JPEG', 0, 0, cardWidthMm, cardHeightMm);
      }

      onProgress?.(i + 1, students.length);
    }

    const suffix = includeBack ? 'Cift_Yonlu_PVC' : 'Tek_Yonlu_PVC';
    pdf.save(`Ogrenci_Kimlik_Kartlari_${suffix}_${students.length}_Ogrenci.pdf`);
    return;
  }

  // A4 Multi-Card Grid Mode (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

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
  const totalChunks = Math.ceil(students.length / cardsPerPage);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const chunkStudents = students.slice(
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

      await renderStudentCardToCanvas(offscreenCanvas, chunkStudents[j], template, {
        side: 'front',
      });
      const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', x, y, cardWidthMm, cardHeightMm);
      drawCropMarksAt(x, y);

      if (!includeBack) {
        onProgress?.(chunkIdx * cardsPerPage + j + 1, students.length);
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

        await renderStudentCardToCanvas(offscreenCanvas, chunkStudents[j], template, {
          side: 'back',
        });
        const backImgData = offscreenCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(backImgData, 'JPEG', x, y, cardWidthMm, cardHeightMm);
        drawCropMarksAt(x, y);

        onProgress?.(chunkIdx * cardsPerPage + j + 1, students.length);
      }
    }
  }

  const suffix = includeBack ? 'Cift_Yonlu_A4' : 'Tek_Yonlu_A4';
  pdf.save(`Toplu_Ogrenci_Kimlik_${suffix}_${students.length}_Ogrenci.pdf`);
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
            let schoolName = defaultSchoolName;
            const rawSchool1 = schoolCol ? String(row[schoolCol] ?? '').trim() : '';
            const rawSchool2 = schoolLine2Col ? String(row[schoolLine2Col] ?? '').trim() : '';
            if (rawSchool1 && rawSchool2) {
              schoolName = `${rawSchool1}\n${rawSchool2}`;
            } else if (rawSchool1) {
              schoolName = rawSchool1.replace(/\s*\|\s*|\s*\/\s*/g, '\n');
            }
            const academicYear =
              yearCol && String(row[yearCol] ?? '').trim()
                ? String(row[yearCol] ?? '').trim()
                : defaultAcademicYear;

            const bloodType = bloodCol ? String(row[bloodCol] ?? '').trim() : 'A Rh(+)';
            const emergencyPhone = emergencyPhoneCol
              ? String(row[emergencyPhoneCol] ?? '').trim()
              : '';

            const cleanKey = normalizePhotoMatchKey(rawNo);
            const matchedPhoto = existingPhotosMap.get(cleanKey);

            return {
              id: `row-${Date.now()}-${idx}`,
              studentNumber: rawNo,
              fullName,
              className,
              schoolName,
              academicYear,
              bloodType,
              emergencyPhone,
              photoDataUrl: matchedPhoto?.dataUrl,
              photoFileName: matchedPhoto?.fileName,
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
  const withoutExt = input.replace(/\.[^/.]+$/, '').trim();
  if (/^\d+$/.test(withoutExt)) {
    return String(parseInt(withoutExt, 10));
  }
  return withoutExt.toLowerCase();
}

export function downloadSampleExcelFile(students: StudentRecord[]) {
  const rows = students.map((s) => {
    const parts = (s.schoolName || '').split(/\r?\n/);
    return {
      'Okul Numarası': s.studentNumber,
      'Adı Soyadı': s.fullName,
      'Sınıfı': s.className,
      'Okul İsmi 1. Satır': parts[0] || '',
      'Okul İsmi 2. Satır': parts[1] || '',
      'Öğretim Yılı': s.academicYear || '2026-2027',
      'Kan Grubu': s.bloodType || 'A Rh(+)',
      'Acil Veli Tel': s.emergencyPhone || '0532 000 00 00',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 24 },
    { wch: 12 },
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
