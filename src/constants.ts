import { BackFieldKey, CardTemplate, FieldPosition, StudentRecord, WatermarkConfig } from './types';

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: false,
  type: 'logo',
  text: 'ÖRNEK KİMLİK KARTI',
  layer: 'background',
  opacity: 0.08,
  scale: 48,
  rotation: -25,
  repeatedPattern: false,
  applyToBackSide: true,
};

/**
 * Calculates the validity period (Dönem / Geçerlilik Süresi) based on student's grade level
 * even when className includes prefixes/suffixes such as "AMP 9-A", "ATP 10/B", "Hazırlık", "Edebiyat 11-C":
 * - Hazırlık -> 5 Yıl (e.g., 2026-2031 (5 Yıl))
 * - 9. Sınıf  -> 4 Yıl (e.g., 2026-2030 (4 Yıl))
 * - 10. Sınıf -> 3 Yıl (e.g., 2026-2029 (3 Yıl))
 * - 11. Sınıf -> 2 Yıl (e.g., 2026-2028 (2 Yıl))
 * - 12. Sınıf -> 1 Yıl (e.g., 2026-2027 (1 Yıl))
 */
export function calculateValidityPeriodByClass(
  className: string,
  baseStartYearInput?: string
): string {
  const yearMatch = (baseStartYearInput || '2026').match(/\b(20\d{2})\b/);
  const startYear = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

  const rawClass = (className || '').trim();
  // Match 10, 11, 12, or 9 anywhere in the class string as a standalone number token
  // (e.g., "Amp 9- a", "ATP 10/B", "11-Edebiyat", "AMP-12A", "9. Sınıf")
  const gradeMatch = rawClass.match(/(?:^|[^\d])(10|11|12|9)(?!\d)/);
  const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : null;

  let durationYears = 1;
  if (grade === 9) {
    durationYears = 4;
  } else if (grade === 10) {
    durationYears = 3;
  } else if (grade === 11) {
    durationYears = 2;
  } else if (grade === 12) {
    durationYears = 1;
  } else if (/haz[ıi]rl[ıi]k/i.test(rawClass)) {
    durationYears = 5;
  } else {
    return `${startYear}-${startYear + 1}`;
  }

  const endYear = startYear + durationYears;
  return `${startYear}-${endYear} (${durationYears} Yıl)`;
}

/**
 * Extracts school prefix (AMP / ATP) from class name and attaches to student number,
 * and infers department / field of study (Alanı) from class name or raw department text.
 */
export function inferDepartmentAndStudentNumber(
  rawNo: string,
  rawClass: string,
  rawDepartment?: string
): { formattedStudentNumber: string; fieldOfStudy: string } {
  const cleanNo = (rawNo || '').trim();
  const cleanClass = (rawClass || '').trim();
  const cleanDept = (rawDepartment || '').trim();

  // 1. Check if class name has AMP / ATP prefix (e.g., "AMP 9-A", "ATP-10B", "AMP/11-C")
  let prefix = '';
  const prefixMatch = cleanClass.match(/\b(AMP|ATP)\b/i);
  if (prefixMatch) {
    prefix = prefixMatch[1].toUpperCase();
  }

  // Prepend prefix to student number (e.g., "1205" with class "AMP 9-A" -> "AMP 1205")
  let formattedStudentNumber = cleanNo;
  if (prefix && cleanNo) {
    const strippedNo = cleanNo.replace(/^(AMP|ATP)[-_\s]*/i, '').trim();
    formattedStudentNumber = `${prefix} ${strippedNo || cleanNo}`;
  }

  // 2. Determine Field of Study (Alanı)
  if (cleanDept) {
    return { formattedStudentNumber, fieldOfStudy: cleanDept };
  }

  // Infer from class name keywords if not explicitly specified
  const lowerClass = cleanClass.toLowerCase();
  let fieldOfStudy = 'Genel Lise Programı';

  if (lowerClass.includes('bilişim') || lowerClass.includes('bilisim') || lowerClass.includes('yazılım') || lowerClass.includes('bt')) {
    fieldOfStudy = 'Bilişim Teknolojileri Alanı';
  } else if (lowerClass.includes('elektrik') || lowerClass.includes('elektronik') || lowerClass.includes('elk')) {
    fieldOfStudy = 'Elektrik-Elektronik Teknolojisi';
  } else if (lowerClass.includes('makine') || lowerClass.includes('makina') || lowerClass.includes('cnc')) {
    fieldOfStudy = 'Makine ve Tasarım Teknolojisi';
  } else if (lowerClass.includes('motor') || lowerClass.includes('otomotiv')) {
    fieldOfStudy = 'Motorlu Araçlar Teknolojisi';
  } else if (lowerClass.includes('inşaat') || lowerClass.includes('insaat') || lowerClass.includes('yapı')) {
    fieldOfStudy = 'İnşaat Teknolojisi Alanı';
  } else if (lowerClass.includes('kimya') || lowerClass.includes('laboratuvar')) {
    fieldOfStudy = 'Kimya Teknolojisi Alanı';
  } else if (lowerClass.includes('sağlık') || lowerClass.includes('saglik') || lowerClass.includes('hemşire')) {
    fieldOfStudy = 'Sağlık Hizmetleri Alanı';
  } else if (lowerClass.includes('muhasebe') || lowerClass.includes('finans')) {
    fieldOfStudy = 'Muhasebe ve Finansman';
  } else if (lowerClass.includes('adalet')) {
    fieldOfStudy = 'Adalet Alanı';
  } else if (lowerClass.includes('çocuk') || lowerClass.includes('cocuk') || lowerClass.includes('gelişim')) {
    fieldOfStudy = 'Çocuk Gelişimi ve Eğitimi';
  } else if (lowerClass.includes('yiyecek') || lowerClass.includes('gastronomi') || lowerClass.includes('mutfak')) {
    fieldOfStudy = 'Yiyecek İçecek Hizmetleri';
  } else if (lowerClass.includes('grafik') || lowerClass.includes('tasarım') || lowerClass.includes('matbaa')) {
    fieldOfStudy = 'Grafik ve Fotoğraf Alanı';
  } else if (lowerClass.includes('fen') || lowerClass.includes('sayısal') || lowerClass.includes('sayisal')) {
    fieldOfStudy = 'Fen Bilimleri (Sayısal)';
  } else if (lowerClass.includes('edebiyat') || lowerClass.includes('türkçe') || lowerClass.includes('sözel') || lowerClass.includes('sozel')) {
    fieldOfStudy = 'Türk Dili ve Edebiyatı (Sözel)';
  } else if (lowerClass.includes('eşit') || lowerClass.includes('tm')) {
    fieldOfStudy = 'Eşit Ağırlık Alanı';
  } else if (lowerClass.includes('yabancı') || lowerClass.includes('dil') || lowerClass.includes('ingilizce')) {
    fieldOfStudy = 'Yabancı Diller Alanı';
  } else if (prefix === 'AMP') {
    fieldOfStudy = 'Anadolu Meslek Programı (AMP)';
  } else if (prefix === 'ATP') {
    fieldOfStudy = 'Anadolu Teknik Programı (ATP)';
  }

  return { formattedStudentNumber, fieldOfStudy };
}

// Generate realistic, high-resolution SVG portrait data URLs so demo students have crisp, zero-broken-image portraits out of the box
function createStudentPortraitDataUrl(
  initials: string,
  bgHex: string,
  shirtHex: string,
  hairHex: string,
  skinHex: string,
  gender: 'f' | 'm',
  studentNo: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 380" width="300" height="380">
    <defs>
      <linearGradient id="bg-${studentNo}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bgHex}" />
        <stop offset="100%" stop-color="#cbd5e1" />
      </linearGradient>
    </defs>
    <rect width="300" height="380" fill="url(#bg-${studentNo})" />
    <circle cx="150" cy="145" r="130" fill="#ffffff" fill-opacity="0.22" />
    <path d="M35 380 C35 288 85 265 150 265 C215 265 265 288 265 380 Z" fill="${shirtHex}" />
    <polygon points="118,265 150,315 182,265" fill="#ffffff" />
    <polygon points="143,288 157,288 160,355 150,368 140,355" fill="#991b1b" />
    <rect x="128" y="215" width="44" height="62" rx="18" fill="${skinHex}" />
    ${
      gender === 'f'
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
      gender === 'f'
        ? `<path d="M88 140 C85 82 115 66 150 66 C185 66 215 82 212 140 C200 108 175 96 150 98 C125 96 100 108 88 140 Z" fill="${hairHex}" />`
        : `<path d="M90 135 C86 78 115 65 150 65 C185 65 214 78 210 135 C198 102 180 94 150 94 C120 94 102 102 90 135 Z" fill="${hairHex}" />`
    }
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createDefaultBackFields(
  orientation: 'landscape' | 'portrait',
  primaryColor: string
): Record<BackFieldKey, FieldPosition> {
  if (orientation === 'portrait') {
    return {
      backTitle: {
        id: 'backTitle',
        label: 'Arka Yüz Başlığı',
        visible: true,
        x: 50,
        y: 8,
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
        align: 'center',
        customText: 'KİMLİK KARTI KULLANIM & İLETİŞİM BİLGİLERİ',
      },
      returnNotice: {
        id: 'returnNotice',
        label: 'Bulunması Halinde Uyarı Metni',
        visible: true,
        x: 50,
        y: 19,
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
        align: 'center',
        customText:
          'Bu kart okul öğrencisine aittir. Başkası tarafından kullanılamaz.\nBulunması halinde lütfen aşağıdaki okul yönetimine teslim ediniz.',
      },
      schoolAddress: {
        id: 'schoolAddress',
        label: 'Okul Adresi',
        visible: true,
        x: 10,
        y: 31,
        fontSize: 17,
        fontWeight: '600',
        color: '#0f172a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Okul Adresi',
        customText: 'Cumhuriyet Mah. Eğitim Cad. No: 42 Çankaya / ANKARA',
      },
      schoolPhone: {
        id: 'schoolPhone',
        label: 'Okul Telefon & E-Posta',
        visible: true,
        x: 10,
        y: 42,
        fontSize: 17,
        fontWeight: '600',
        color: '#0f172a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Telefon & İletişim',
        customText: 'Tel: (0312) 444 0 123 · info@ataturkfen.meb.k12.tr',
      },
      schoolWebsite: {
        id: 'schoolWebsite',
        label: 'Okul Web Sitesi',
        visible: true,
        x: 10,
        y: 52,
        fontSize: 16,
        fontWeight: '600',
        color: primaryColor,
        align: 'left',
        showPrefix: true,
        prefixText: 'Resmi Web Adresi',
        customText: 'www.ataturkfenlisesi.meb.k12.tr',
      },
      studentInfoSummary: {
        id: 'studentInfoSummary',
        label: 'Kan Grubu & Acil Veli Tel',
        visible: true,
        x: 10,
        y: 62,
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Acil Durum & Kan Grubu Bilgisi',
        customText: 'Kan Grubu: {bloodType}   |   Veli Tel: {emergencyPhone}',
      },
      studentSignatureBox: {
        id: 'studentSignatureBox',
        label: 'Öğrenci İmza Alanı',
        visible: true,
        x: 10,
        y: 72,
        width: 36,
        height: 12,
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        align: 'center',
        customText: 'ÖĞRENCİ İMZASI',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#94a3b8',
      },
      principalApproval: {
        id: 'principalApproval',
        label: 'Okul Müdürü İmza / Mühür',
        visible: true,
        x: 54,
        y: 72,
        width: 36,
        height: 12,
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        align: 'center',
        customText: 'OKUL MÜDÜRÜ\nİmza / Mühür',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#94a3b8',
      },
      backBarcode: {
        id: 'backBarcode',
        label: 'Arka Yüz Barkod',
        visible: true,
        x: 20,
        y: 87,
        width: 60,
        height: 7,
        fontSize: 12,
        fontWeight: '400',
        color: '#0f172a',
        align: 'center',
      },
    };
  }

  // Landscape default back fields
  return {
    backTitle: {
      id: 'backTitle',
      label: 'Arka Yüz Başlığı',
      visible: true,
      x: 50,
      y: 6.5,
      fontSize: 22,
      fontWeight: '700',
      color: '#ffffff',
      align: 'center',
      customText: 'KİMLİK KARTI KULLANIM VE OKUL İLETİŞİM BİLGİLERİ',
    },
    returnNotice: {
      id: 'returnNotice',
      label: 'Bulunması Halinde Uyarı Metni',
      visible: true,
      x: 50,
      y: 21,
      fontSize: 17,
      fontWeight: '600',
      color: '#334155',
      align: 'center',
      customText:
        'Bu kimlik kartı öğrencilik süresince geçerlidir ve başkası tarafından kullanılamaz.\nBulunması halinde lütfen en yakın eğitim kurumuna veya aşağıdaki adrese teslim ediniz.',
    },
    schoolAddress: {
      id: 'schoolAddress',
      label: 'Okul Adresi',
      visible: true,
      x: 6,
      y: 36,
      fontSize: 19,
      fontWeight: '600',
      color: '#0f172a',
      align: 'left',
      showPrefix: true,
      prefixText: 'Okul Adresi',
      customText: 'Cumhuriyet Mah. Eğitim Cad. No: 42 Çankaya / ANKARA',
    },
    schoolPhone: {
      id: 'schoolPhone',
      label: 'Okul Telefon & E-Posta',
      visible: true,
      x: 6,
      y: 52,
      fontSize: 19,
      fontWeight: '600',
      color: '#0f172a',
      align: 'left',
      showPrefix: true,
      prefixText: 'Okul İletişim & Telefon',
      customText: 'Tel: (0312) 444 0 123 · E-Posta: info@ataturkfen.meb.k12.tr',
    },
    schoolWebsite: {
      id: 'schoolWebsite',
      label: 'Okul Web Sitesi',
      visible: true,
      x: 6,
      y: 67,
      fontSize: 18,
      fontWeight: '600',
      color: primaryColor,
      align: 'left',
      showPrefix: true,
      prefixText: 'Resmi Web Adresi',
      customText: 'www.ataturkfenlisesi.meb.k12.tr',
    },
    studentInfoSummary: {
      id: 'studentInfoSummary',
      label: 'Kan Grubu & Acil Veli Tel',
      visible: true,
      x: 6,
      y: 81,
      fontSize: 18,
      fontWeight: '700',
      color: '#0f172a',
      align: 'left',
      showPrefix: true,
      prefixText: 'Öğrenci Acil Durum Bilgisi',
      customText: 'Kan Grubu: {bloodType}  ·  Acil Veli Tel: {emergencyPhone}',
    },
    studentSignatureBox: {
      id: 'studentSignatureBox',
      label: 'Öğrenci İmza Alanı',
      visible: true,
      x: 64,
      y: 36,
      width: 30,
      height: 24,
      fontSize: 15,
      fontWeight: '700',
      color: '#334155',
      align: 'center',
      customText: 'ÖĞRENCİ İMZASI',
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#94a3b8',
    },
    principalApproval: {
      id: 'principalApproval',
      label: 'Okul Müdürü İmza / Mühür',
      visible: true,
      x: 64,
      y: 65,
      width: 30,
      height: 24,
      fontSize: 15,
      fontWeight: '700',
      color: '#0f172a',
      align: 'center',
      customText: 'OKUL MÜDÜRÜ\nİmza ve Mühür',
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#94a3b8',
    },
    backBarcode: {
      id: 'backBarcode',
      label: 'Arka Yüz Barkod',
      visible: false,
      x: 64,
      y: 82,
      width: 30,
      height: 10,
      fontSize: 12,
      fontWeight: '400',
      color: '#0f172a',
      align: 'center',
    },
  };
}

export const INITIAL_STUDENTS: StudentRecord[] = [
  {
    id: 'std-1',
    studentNumber: 'ATP 1042',
    fullName: 'Elif Yılmaz',
    schoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nAtatürk Fen ve Teknik Lisesi',
    className: 'ATP 10-A',
    fieldOfStudy: 'Bilişim Teknolojileri Alanı',
    academicYear: calculateValidityPeriodByClass('ATP 10-A', '2026'),
    bloodType: 'A Rh(+)',
    emergencyPhone: '0532 111 22 33',
    photoFileName: '1042.jpg',
    photoDataUrl: createStudentPortraitDataUrl('EY', '#e2e8f0', '#1e3a8a', '#271c19', '#f5d0b5', 'f', '1042'),
  },
  {
    id: 'std-2',
    studentNumber: 'ATP 1045',
    fullName: 'Kerem Demir',
    schoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nAtatürk Fen ve Teknik Lisesi',
    className: 'ATP 10-B',
    fieldOfStudy: 'Elektrik-Elektronik Teknolojisi',
    academicYear: calculateValidityPeriodByClass('ATP 10-B', '2026'),
    bloodType: '0 Rh(+)',
    emergencyPhone: '0533 222 33 44',
    photoFileName: '1045.jpg',
    photoDataUrl: createStudentPortraitDataUrl('KD', '#dbeafe', '#0f172a', '#452c1e', '#ecc1a1', 'm', '1045'),
  },
  {
    id: 'std-3',
    studentNumber: 'AMP 1088',
    fullName: 'Zeynep Kaya',
    schoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nAtatürk Fen ve Teknik Lisesi',
    className: 'AMP 11-A',
    fieldOfStudy: 'Makine ve Tasarım Teknolojisi',
    academicYear: calculateValidityPeriodByClass('AMP 11-A', '2026'),
    bloodType: 'B Rh(+)',
    emergencyPhone: '0542 333 44 55',
    photoFileName: '1088.jpg',
    photoDataUrl: createStudentPortraitDataUrl('ZK', '#e0f2fe', '#1e293b', '#5c3a21', '#f7d7c4', 'f', '1088'),
  },
  {
    id: 'std-4',
    studentNumber: 'ATP 1104',
    fullName: 'Mert Çelik',
    schoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nAtatürk Fen ve Teknik Lisesi',
    className: 'ATP 11-B',
    fieldOfStudy: 'Bilişim Teknolojileri (Yazılım)',
    academicYear: calculateValidityPeriodByClass('ATP 11-B', '2026'),
    bloodType: 'AB Rh(+)',
    emergencyPhone: '0505 444 55 66',
    photoFileName: '1104.jpg',
    photoDataUrl: createStudentPortraitDataUrl('MÇ', '#f1f5f9', '#1e3a8a', '#1c1917', '#e5b899', 'm', '1104'),
  },
  {
    id: 'std-5',
    studentNumber: 'AMP 1129',
    fullName: 'Defne Şahin',
    schoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nAtatürk Fen ve Teknik Lisesi',
    className: 'AMP 9-A',
    fieldOfStudy: 'Grafik ve Tasarım Alanı',
    academicYear: calculateValidityPeriodByClass('AMP 9-A', '2026'),
    bloodType: 'A Rh(-)',
    emergencyPhone: '0535 555 66 77',
    photoFileName: '1129.jpg',
    photoDataUrl: createStudentPortraitDataUrl('DŞ', '#e2e8f0', '#0f172a', '#3b2314', '#f3cfb6', 'f', '1129'),
  },
  {
    id: 'std-6',
    studentNumber: 'AMP 1156',
    fullName: 'Caner Aydın',
    schoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nAtatürk Fen ve Teknik Lisesi',
    className: 'AMP 12-A',
    fieldOfStudy: 'Motorlu Araçlar Teknolojisi',
    academicYear: calculateValidityPeriodByClass('AMP 12-A', '2026'),
    bloodType: '0 Rh(-)',
    emergencyPhone: '0544 666 77 88',
    photoFileName: '1156.jpg',
    photoDataUrl: createStudentPortraitDataUrl('CA', '#dbeafe', '#1e3a8a', '#292524', '#eab996', 'm', '1156'),
  },
];

export const BUILT_IN_TEMPLATES: CardTemplate[] = [
  {
    id: 'meb-classic',
    name: 'Klasik Kurumsal (Lacivert & Altın)',
    description: 'Resmi okul standartlarına uygun yatay kimlik kartı. Üst şerit başlık, sol çerçeveli fotoğraf ve barkod alanı içerir.',
    orientation: 'landscape',
    primaryColor: '#0f294a',
    secondaryColor: '#1e40af',
    accentColor: '#d97706',
    backgroundColor: '#ffffff',
    defaultSchoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nATATÜRK FEN LİSESİ',
    defaultAcademicYear: '2026-2027',
    cardTitleText: 'ÖĞRENCİ KİMLİK KARTI',
    enableBackSide: false,
    watermark: { ...DEFAULT_WATERMARK_CONFIG },
    fields: {
      schoolName: {
        id: 'schoolName',
        label: 'Okul İsmi',
        visible: true,
        x: 54,
        y: 3.5,
        fontSize: 18,
        secondLineFontSize: 22,
        secondLineAlign: 'center',
        secondLineX: 54,
        secondLineYOffset: 0,
        fontWeight: '700',
        color: '#ffffff',
        align: 'center',
        showPrefix: false,
      },
      cardTitle: {
        id: 'cardTitle',
        label: 'Kart Başlığı',
        visible: true,
        x: 54,
        y: 16.5,
        fontSize: 16,
        fontWeight: '600',
        color: '#fcd34d',
        align: 'center',
        showPrefix: false,
      },
      photo: {
        id: 'photo',
        label: 'Öğrenci Fotoğrafı',
        visible: true,
        x: 7,
        y: 29,
        width: 26,
        height: 55,
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        align: 'center',
        borderRadius: 6,
        borderWidth: 3,
        borderColor: '#0f294a',
      },
      fullName: {
        id: 'fullName',
        label: 'Adı Soyadı',
        visible: true,
        x: 38,
        y: 35,
        fontSize: 26,
        fontWeight: '700',
        color: '#0f172a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Adı Soyadı',
      },
      studentNumber: {
        id: 'studentNumber',
        label: 'Okul Numarası',
        visible: true,
        x: 38,
        y: 52,
        fontSize: 24,
        fontWeight: '700',
        color: '#0f294a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Okul No',
      },
      className: {
        id: 'className',
        label: 'Alanı / Bölümü',
        visible: true,
        x: 68,
        y: 52,
        fontSize: 22,
        fontWeight: '700',
        color: '#0f294a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Alanı',
      },
      academicYear: {
        id: 'academicYear',
        label: 'Dönem / Geçerlilik',
        visible: true,
        x: 38,
        y: 68,
        fontSize: 19,
        fontWeight: '600',
        color: '#475569',
        align: 'left',
        showPrefix: true,
        prefixText: 'Dönem / Geçerlilik Süresi',
      },
      barcode: {
        id: 'barcode',
        label: 'Kimlik Barkodu',
        visible: true,
        x: 38,
        y: 79,
        width: 54,
        height: 11,
        fontSize: 12,
        fontWeight: '400',
        color: '#0f172a',
        align: 'left',
      },
    },
    backFields: createDefaultBackFields('landscape', '#0f294a'),
  },
  {
    id: 'modern-campus',
    name: 'Modern Kampüs (Geometrik Mavi)',
    description: 'Çağdaş eğitim kurumları için dinamik açılı şeritler, yüksek kontrastlı bilgi blokları ve ferah tipografi.',
    orientation: 'landscape',
    primaryColor: '#1d4ed8',
    secondaryColor: '#0f172a',
    accentColor: '#38bdf8',
    backgroundColor: '#f8fafc',
    defaultSchoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nATATÜRK FEN LİSESİ',
    defaultAcademicYear: '2026-2027',
    cardTitleText: 'ÖĞRENCİ KARTI',
    enableBackSide: false,
    watermark: { ...DEFAULT_WATERMARK_CONFIG },
    fields: {
      schoolName: {
        id: 'schoolName',
        label: 'Okul İsmi',
        visible: true,
        x: 16.5,
        y: 4.5,
        fontSize: 18,
        secondLineFontSize: 22,
        secondLineAlign: 'left',
        secondLineX: 16.5,
        secondLineYOffset: 0,
        fontWeight: '700',
        color: '#ffffff',
        align: 'left',
        showPrefix: false,
      },
      cardTitle: {
        id: 'cardTitle',
        label: 'Kart Başlığı',
        visible: true,
        x: 94,
        y: 13.5,
        fontSize: 16,
        fontWeight: '600',
        color: '#bae6fd',
        align: 'right',
        showPrefix: false,
      },
      photo: {
        id: 'photo',
        label: 'Öğrenci Fotoğrafı',
        visible: true,
        x: 68,
        y: 26,
        width: 26,
        height: 56,
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        align: 'center',
        borderRadius: 10,
        borderWidth: 4,
        borderColor: '#ffffff',
      },
      fullName: {
        id: 'fullName',
        label: 'Adı Soyadı',
        visible: true,
        x: 7,
        y: 34,
        fontSize: 28,
        fontWeight: '700',
        color: '#0f172a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Öğrenci Adı Soyadı',
      },
      studentNumber: {
        id: 'studentNumber',
        label: 'Okul Numarası',
        visible: true,
        x: 7,
        y: 53,
        fontSize: 25,
        fontWeight: '700',
        color: '#1d4ed8',
        align: 'left',
        showPrefix: true,
        prefixText: 'Okul Numarası',
      },
      className: {
        id: 'className',
        label: 'Alanı / Bölümü',
        visible: true,
        x: 38,
        y: 53,
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Alanı',
      },
      academicYear: {
        id: 'academicYear',
        label: 'Dönem / Geçerlilik',
        visible: true,
        x: 7,
        y: 70,
        fontSize: 19,
        fontWeight: '600',
        color: '#475569',
        align: 'left',
        showPrefix: true,
        prefixText: 'Dönem / Geçerlilik Süresi',
      },
      barcode: {
        id: 'barcode',
        label: 'Kimlik Barkodu',
        visible: true,
        x: 7,
        y: 80,
        width: 52,
        height: 10,
        fontSize: 12,
        fontWeight: '400',
        color: '#0f172a',
        align: 'left',
      },
    },
    backFields: createDefaultBackFields('landscape', '#1d4ed8'),
  },
  {
    id: 'emerald-college',
    name: 'Akademik Kolej (Zümrüt Yeşili)',
    description: 'Özel okullar ve kolejler için zarif zümrüt yeşili ve krem detaylara sahip prestijli yatay tasarım.',
    orientation: 'landscape',
    primaryColor: '#064e3b',
    secondaryColor: '#047857',
    accentColor: '#f59e0b',
    backgroundColor: '#ffffff',
    defaultSchoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nATATÜRK FEN LİSESİ',
    defaultAcademicYear: '2026-2027',
    cardTitleText: 'ÖĞRENCİ KİMLİK BELGESİ',
    enableBackSide: false,
    watermark: { ...DEFAULT_WATERMARK_CONFIG },
    fields: {
      schoolName: {
        id: 'schoolName',
        label: 'Okul İsmi',
        visible: true,
        x: 52,
        y: 3.5,
        fontSize: 18,
        secondLineFontSize: 22,
        secondLineAlign: 'center',
        secondLineX: 52,
        secondLineYOffset: 0,
        fontWeight: '700',
        color: '#ffffff',
        align: 'center',
        showPrefix: false,
      },
      cardTitle: {
        id: 'cardTitle',
        label: 'Kart Başlığı',
        visible: true,
        x: 52,
        y: 16.5,
        fontSize: 16,
        fontWeight: '600',
        color: '#fde68a',
        align: 'center',
        showPrefix: false,
      },
      photo: {
        id: 'photo',
        label: 'Öğrenci Fotoğrafı',
        visible: true,
        x: 7,
        y: 28,
        width: 26,
        height: 56,
        fontSize: 14,
        fontWeight: '600',
        color: '#064e3b',
        align: 'center',
        borderRadius: 8,
        borderWidth: 3,
        borderColor: '#064e3b',
      },
      fullName: {
        id: 'fullName',
        label: 'Adı Soyadı',
        visible: true,
        x: 38,
        y: 35,
        fontSize: 27,
        fontWeight: '700',
        color: '#064e3b',
        align: 'left',
        showPrefix: true,
        prefixText: 'Adı Soyadı',
      },
      studentNumber: {
        id: 'studentNumber',
        label: 'Okul Numarası',
        visible: true,
        x: 38,
        y: 52,
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Öğrenci No',
      },
      className: {
        id: 'className',
        label: 'Alanı / Bölümü',
        visible: true,
        x: 68,
        y: 52,
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
        align: 'left',
        showPrefix: true,
        prefixText: 'Alanı',
      },
      academicYear: {
        id: 'academicYear',
        label: 'Dönem / Geçerlilik',
        visible: true,
        x: 38,
        y: 68,
        fontSize: 19,
        fontWeight: '600',
        color: '#475569',
        align: 'left',
        showPrefix: true,
        prefixText: 'Dönem / Geçerlilik Süresi',
      },
      barcode: {
        id: 'barcode',
        label: 'Kimlik Barkodu',
        visible: true,
        x: 38,
        y: 79,
        width: 54,
        height: 11,
        fontSize: 12,
        fontWeight: '400',
        color: '#064e3b',
        align: 'left',
      },
    },
    backFields: createDefaultBackFields('landscape', '#064e3b'),
  },
  {
    id: 'vertical-lanyard',
    name: 'Dikey Yaka Kartı (Boyun Askılı)',
    description: 'Boyun askı aparatları ve turnike geçiş sistemleri için optimize edilmiş dikey CR80 kimlik şablonu.',
    orientation: 'portrait',
    primaryColor: '#0f172a',
    secondaryColor: '#2563eb',
    accentColor: '#38bdf8',
    backgroundColor: '#ffffff',
    defaultSchoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nATATÜRK FEN LİSESİ',
    defaultAcademicYear: '2026-2027',
    cardTitleText: 'ÖĞRENCİ KİMLİK KARTI',
    enableBackSide: false,
    watermark: { ...DEFAULT_WATERMARK_CONFIG },
    fields: {
      schoolName: {
        id: 'schoolName',
        label: 'Okul İsmi',
        visible: true,
        x: 50,
        y: 6,
        fontSize: 16,
        secondLineFontSize: 20,
        secondLineAlign: 'center',
        secondLineX: 50,
        secondLineYOffset: 0,
        fontWeight: '700',
        color: '#ffffff',
        align: 'center',
        showPrefix: false,
      },
      cardTitle: {
        id: 'cardTitle',
        label: 'Kart Başlığı',
        visible: true,
        x: 50,
        y: 15.5,
        fontSize: 15,
        fontWeight: '600',
        color: '#93c5fd',
        align: 'center',
        showPrefix: false,
      },
      photo: {
        id: 'photo',
        label: 'Öğrenci Fotoğrafı',
        visible: true,
        x: 26,
        y: 21,
        width: 48,
        height: 35,
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        align: 'center',
        borderRadius: 8,
        borderWidth: 4,
        borderColor: '#ffffff',
      },
      fullName: {
        id: 'fullName',
        label: 'Adı Soyadı',
        visible: true,
        x: 50,
        y: 62,
        fontSize: 26,
        fontWeight: '700',
        color: '#0f172a',
        align: 'center',
        showPrefix: false,
      },
      studentNumber: {
        id: 'studentNumber',
        label: 'Okul Numarası',
        visible: true,
        x: 28,
        y: 73,
        fontSize: 22,
        fontWeight: '700',
        color: '#1d4ed8',
        align: 'center',
        showPrefix: true,
        prefixText: 'Okul No',
      },
      className: {
        id: 'className',
        label: 'Alanı / Bölümü',
        visible: true,
        x: 72,
        y: 73,
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        align: 'center',
        showPrefix: true,
        prefixText: 'Alanı',
      },
      academicYear: {
        id: 'academicYear',
        label: 'Dönem / Geçerlilik',
        visible: true,
        x: 50,
        y: 82,
        fontSize: 17,
        fontWeight: '600',
        color: '#64748b',
        align: 'center',
        showPrefix: false,
      },
      barcode: {
        id: 'barcode',
        label: 'Kimlik Barkodu',
        visible: true,
        x: 18,
        y: 87,
        width: 64,
        height: 8,
        fontSize: 12,
        fontWeight: '400',
        color: '#0f172a',
        align: 'center',
      },
    },
    backFields: createDefaultBackFields('portrait', '#0f172a'),
  },
];

export const DEFAULT_VISITOR_TEMPLATE: CardTemplate = {
  id: 'meb-classic',
  name: 'Ziyaretçi Kartı Şablonu (Tek Yüzlü & Fotoğrafsız)',
  description: 'Nizamiye ve güvenlik girişleri için tek yüzlü, fotoğrafsız resmi ziyaretçi kartı.',
  orientation: 'landscape',
  primaryColor: '#1e3a8a',
  secondaryColor: '#2563eb',
  accentColor: '#d97706',
  backgroundColor: '#ffffff',
  defaultSchoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nATATÜRK FEN LİSESİ',
  defaultAcademicYear: 'GÜNÜBİRLİK',
  cardTitleText: 'ZİYARETÇİ KARTI',
  enableBackSide: false,
  watermark: {
    ...DEFAULT_WATERMARK_CONFIG,
    enabled: false,
    type: 'text',
    text: 'ZİYARETÇİ',
    opacity: 0.12,
    scale: 55,
    rotation: -25,
    layer: 'background',
    repeatedPattern: false,
  },
  fields: {
    schoolName: {
      id: 'schoolName',
      label: 'Okul İsmi',
      visible: true,
      x: 54,
      y: 3.5,
      fontSize: 18,
      secondLineFontSize: 22,
      secondLineAlign: 'center',
      secondLineX: 54,
      secondLineYOffset: 0,
      fontWeight: '700',
      color: '#ffffff',
      align: 'center',
      showPrefix: false,
    },
    cardTitle: {
      id: 'cardTitle',
      label: 'Kart Başlığı',
      visible: true,
      x: 54,
      y: 16.5,
      fontSize: 17,
      fontWeight: '700',
      color: '#fcd34d',
      align: 'center',
      showPrefix: false,
    },
    photo: {
      id: 'photo',
      label: 'Fotoğraf (Bu Kart Tipinde Kapalı)',
      visible: false,
      x: 10,
      y: 30,
      width: 25,
      height: 50,
      fontSize: 14,
      fontWeight: '600',
      color: '#0f172a',
      align: 'center',
      borderRadius: 6,
      borderWidth: 0,
    },
    fullName: {
      id: 'fullName',
      label: 'Ziyaretçi Tanımı',
      visible: true,
      x: 50,
      y: 30,
      fontSize: 32,
      fontWeight: '700',
      color: '#1e3a8a',
      align: 'center',
      showPrefix: false,
      prefixText: '',
    },
    studentNumber: {
      id: 'studentNumber',
      label: 'Kart Numarası',
      visible: true,
      x: 50,
      y: 45,
      fontSize: 34,
      fontWeight: '700',
      color: '#0f172a',
      align: 'center',
      showPrefix: true,
      prefixText: 'KART NO',
    },
    className: {
      id: 'className',
      label: 'Açıklama / Alanı / Görevi',
      visible: true,
      x: 50,
      y: 62,
      fontSize: 21,
      fontWeight: '600',
      color: '#334155',
      align: 'center',
      showPrefix: false,
      prefixText: '',
    },
    academicYear: {
      id: 'academicYear',
      label: 'Geçerlilik',
      visible: true,
      x: 50,
      y: 73,
      fontSize: 17,
      fontWeight: '700',
      color: '#b91c1c',
      align: 'center',
      showPrefix: true,
      prefixText: 'GEÇERLİLİK',
    },
    barcode: {
      id: 'barcode',
      label: 'Doğrulama Barkodu',
      visible: true,
      x: 24,
      y: 82,
      width: 52,
      height: 10,
      fontSize: 13,
      fontWeight: '600',
      color: '#0f172a',
      align: 'center',
    },
  },
  backFields: createDefaultBackFields('landscape', '#1e3a8a'),
};

export const DEFAULT_STAFF_TEMPLATE: CardTemplate = {
  id: 'meb-classic',
  name: 'Görevli Kartı Şablonu (Tek Yüzlü & Fotoğrafsız)',
  description: 'Sınav, etkinlik ve kurum personeli için tek yüzlü, fotoğrafsız resmi görevli kartı.',
  orientation: 'landscape',
  primaryColor: '#065f46',
  secondaryColor: '#047857',
  accentColor: '#d97706',
  backgroundColor: '#ffffff',
  defaultSchoolName: 'T.C. MİLLÎ EĞİTİM BAKANLIĞI\nATATÜRK FEN LİSESİ',
  defaultAcademicYear: '2026-2027',
  cardTitleText: 'GÖREVLİ KARTI',
  enableBackSide: false,
  watermark: {
    ...DEFAULT_WATERMARK_CONFIG,
    enabled: false,
    type: 'text',
    text: 'GÖREVLİ',
    opacity: 0.12,
    scale: 55,
    rotation: -25,
    layer: 'background',
    repeatedPattern: false,
  },
  fields: {
    schoolName: {
      id: 'schoolName',
      label: 'Okul İsmi',
      visible: true,
      x: 54,
      y: 3.5,
      fontSize: 18,
      secondLineFontSize: 22,
      secondLineAlign: 'center',
      secondLineX: 54,
      secondLineYOffset: 0,
      fontWeight: '700',
      color: '#ffffff',
      align: 'center',
      showPrefix: false,
    },
    cardTitle: {
      id: 'cardTitle',
      label: 'Kart Başlığı',
      visible: true,
      x: 54,
      y: 16.5,
      fontSize: 17,
      fontWeight: '700',
      color: '#fcd34d',
      align: 'center',
      showPrefix: false,
    },
    photo: {
      id: 'photo',
      label: 'Fotoğraf (Bu Kart Tipinde Kapalı)',
      visible: false,
      x: 10,
      y: 30,
      width: 25,
      height: 50,
      fontSize: 14,
      fontWeight: '600',
      color: '#0f172a',
      align: 'center',
      borderRadius: 6,
      borderWidth: 0,
    },
    fullName: {
      id: 'fullName',
      label: 'Görevli Tanımı',
      visible: true,
      x: 50,
      y: 30,
      fontSize: 32,
      fontWeight: '700',
      color: '#065f46',
      align: 'center',
      showPrefix: false,
      prefixText: '',
    },
    studentNumber: {
      id: 'studentNumber',
      label: 'Kart Numarası',
      visible: true,
      x: 50,
      y: 45,
      fontSize: 34,
      fontWeight: '700',
      color: '#0f172a',
      align: 'center',
      showPrefix: true,
      prefixText: 'KART NO',
    },
    className: {
      id: 'className',
      label: 'Görevi / Alanı',
      visible: true,
      x: 50,
      y: 62,
      fontSize: 21,
      fontWeight: '600',
      color: '#334155',
      align: 'center',
      showPrefix: false,
      prefixText: '',
    },
    academicYear: {
      id: 'academicYear',
      label: 'Geçerlilik',
      visible: true,
      x: 50,
      y: 73,
      fontSize: 17,
      fontWeight: '700',
      color: '#065f46',
      align: 'center',
      showPrefix: true,
      prefixText: 'DÖNEM',
    },
    barcode: {
      id: 'barcode',
      label: 'Doğrulama Barkodu',
      visible: true,
      x: 24,
      y: 82,
      width: 52,
      height: 10,
      fontSize: 13,
      fontWeight: '600',
      color: '#0f172a',
      align: 'center',
    },
  },
  backFields: createDefaultBackFields('landscape', '#065f46'),
};
