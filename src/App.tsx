import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderUp,
  Image as ImageIcon,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  FileCheck,
  FlipHorizontal,
  Shield,
  UserCheck,
  IdCard,
} from 'lucide-react';
import {
  BUILT_IN_TEMPLATES,
  calculateValidityPeriodByClass,
  DEFAULT_WATERMARK_CONFIG,
  inferDepartmentAndStudentNumber,
  INITIAL_STUDENTS,
} from './constants';
import {
  BackFieldKey,
  CardTemplate,
  FieldKey,
  FieldPosition,
  FrontFieldKey,
  PdfExportSettings,
  StudentRecord,
  WatermarkConfig,
} from './types';
import { CardCanvasPreview } from './components/CardCanvasPreview';
import {
  downloadSampleExcelFile,
  generateBatchStudentCardsPdf,
  normalizePhotoMatchKey,
  parseSpreadsheetFile,
} from './utils/pdfExporter';
import { generateStaffCards, generateVisitorCards } from './utils/visitorCards';

type ActiveTab = 'data-matching' | 'template-studio' | 'visitor-staff' | 'batch-preview';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('data-matching');

  // Student Records State
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [photoFilter, setPhotoFilter] = useState<'all' | 'matched' | 'missing'>('all');

  // Uploaded Photo Pool (keyed by normalized studentNumber -> { dataUrl, fileName })
  const [photoPool, setPhotoPool] = useState<Map<string, { dataUrl: string; fileName: string }>>(() => {
    const initialMap = new Map<string, { dataUrl: string; fileName: string }>();
    for (const s of INITIAL_STUDENTS) {
      if (s.photoDataUrl && s.photoFileName) {
        initialMap.set(normalizePhotoMatchKey(s.studentNumber), {
          dataUrl: s.photoDataUrl,
          fileName: s.photoFileName,
        });
      }
    }
    return initialMap;
  });

  // Template & Customization State
  const [templates, setTemplates] = useState<CardTemplate[]>(BUILT_IN_TEMPLATES);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(BUILT_IN_TEMPLATES[0].id);
  const [editingSide, setEditingSide] = useState<'front' | 'back'>('front');
  const [selectedFrontField, setSelectedFrontField] = useState<FrontFieldKey>('photo');
  const [selectedBackField, setSelectedBackField] = useState<BackFieldKey>('schoolAddress');
  const [previewStudentIndex, setPreviewStudentIndex] = useState<number>(0);

  // Global School Override (applies to all students or new imports) - Supports 2 lines
  const [globalSchoolLine1, setGlobalSchoolLine1] = useState<string>('T.C. MİLLÎ EĞİTİM BAKANLIĞI');
  const [globalSchoolLine2, setGlobalSchoolLine2] = useState<string>('Atatürk Fen Lisesi');
  const [globalAcademicYear, setGlobalAcademicYear] = useState<string>('2026-2027');

  const combinedGlobalSchoolName = useMemo(() => {
    return [globalSchoolLine1.trim(), globalSchoolLine2.trim()].filter(Boolean).join('\n');
  }, [globalSchoolLine1, globalSchoolLine2]);

  // PDF Export Settings & Progress
  const [pdfSettings, setPdfSettings] = useState<PdfExportSettings>({
    layoutMode: 'a4-grid',
    includeBackSide: false,
    showCropMarks: true,
    cardSpacingMm: 4,
    qualityScale: 2,
  });
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    message: string;
  } | null>(null);

  // Quick Add Student Form State
  const [newStudent, setNewStudent] = useState({
    studentNumber: '',
    fullName: '',
    className: 'AMP 9-A',
    fieldOfStudy: '',
    schoolName: 'Atatürk Fen ve Teknik Lisesi',
  });

  // Visitor & Staff Card Generation State
  const [visitorMode, setVisitorMode] = useState<'visitor' | 'staff'>('visitor');
  const [visitorSide, setVisitorSide] = useState<'front' | 'back'>('front');
  const [visitorCardCount, setVisitorCardCount] = useState<number>(10);
  const [visitorCardPrefix, setVisitorCardPrefix] = useState<string>('ZYR');
  const [visitorCardTitle, setVisitorCardTitle] = useState<string>('ZİYARETÇİ KARTI');
  const [visitorCardSubtitle, setVisitorCardSubtitle] = useState<string>('Günübirlik Giriş / Güvenlik Kontrolü');

  const [staffCardCount, setStaffCardCount] = useState<number>(5);
  const [staffCardPrefix, setStaffCardPrefix] = useState<string>('GRV');
  const [staffCardTitle, setStaffCardTitle] = useState<string>('GÖREVLİ KARTI');
  const [staffCardSubtitle, setStaffCardSubtitle] = useState<string>('Sınav & Etkinlik Görevlisi');

  // File input refs
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const customTemplateBgInputRef = useRef<HTMLInputElement | null>(null);
  const customBackBgInputRef = useRef<HTMLInputElement | null>(null);
  const schoolLogoInputRef = useRef<HTMLInputElement | null>(null);
  const principalSigInputRef = useRef<HTMLInputElement | null>(null);
  const singleRowPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [singlePhotoTargetStudentId, setSinglePhotoTargetStudentId] = useState<string | null>(null);

  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === activeTemplateId) || templates[0];
  }, [templates, activeTemplateId]);

  const updateActiveTemplate = (updater: (prev: CardTemplate) => CardTemplate) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === activeTemplate.id ? updater(t) : t))
    );
  };

  const activeWatermark: WatermarkConfig = activeTemplate.watermark || DEFAULT_WATERMARK_CONFIG;

  const updateWatermark = (patch: Partial<WatermarkConfig>) => {
    setTemplates((prev) =>
      prev.map((t) => ({
        ...t,
        watermark: {
          ...(t.watermark || DEFAULT_WATERMARK_CONFIG),
          ...patch,
        },
      }))
    );
  };

  // Toggle optional Back Side globally across templates or current template
  const handleToggleBackSide = (enabled: boolean) => {
    setTemplates((prev) =>
      prev.map((t) => ({
        ...t,
        enableBackSide: enabled,
      }))
    );
    setPdfSettings((s) => ({
      ...s,
      includeBackSide: enabled,
    }));
    if (enabled) {
      setEditingSide('back');
    } else {
      setEditingSide('front');
    }
  };

  // Unique classes for filter bar
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set).sort();
  }, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q) ||
        s.schoolName.toLowerCase().includes(q);

      const matchesClass = classFilter === 'all' || s.className === classFilter;
      const matchesPhoto =
        photoFilter === 'all' ||
        (photoFilter === 'matched' && Boolean(s.photoDataUrl)) ||
        (photoFilter === 'missing' && !s.photoDataUrl);

      return matchesSearch && matchesClass && matchesPhoto;
    });
  }, [students, searchQuery, classFilter, photoFilter]);

  // Statistics
  const matchedPhotosCount = useMemo(
    () => students.filter((s) => Boolean(s.photoDataUrl)).length,
    [students]
  );
  const missingPhotosCount = students.length - matchedPhotosCount;

  // Handle Excel / CSV Import
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { students: importedStudents } = await parseSpreadsheetFile(
        file,
        combinedGlobalSchoolName,
        globalAcademicYear,
        photoPool
      );

      if (importedStudents.length === 0) {
        setStatusBanner({
          type: 'warning',
          message: 'Yüklenen dosyada geçerli öğrenci satırı bulunamadı. Lütfen sütun başlıklarını kontrol edin.',
        });
        return;
      }

      setStudents(importedStudents);
      setPreviewStudentIndex(0);
      const matched = importedStudents.filter((s) => Boolean(s.photoDataUrl)).length;
      setStatusBanner({
        type: 'success',
        message: `${file.name} dosyasından ${importedStudents.length} öğrenci başarıyla aktarıldı. (${matched} fotoğraf otomatik eşleşti)`,
      });
    } catch {
      setStatusBanner({
        type: 'warning',
        message: 'Excel/CSV dosyası okunurken bir hata oluştu. Lütfen dosya formatını kontrol edin.',
      });
    } finally {
      e.target.value = '';
    }
  };

  // Handle Batch Student Photos Upload (Matched by studentNumber in filename e.g., 1042.jpg)
  const handleBatchPhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files: File[] = Array.from(fileList);
    const newEntries = new Map<string, { dataUrl: string; fileName: string }>(photoPool);

    await Promise.all(
      files.map(
        (file) =>
          new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              if (dataUrl) {
                const key = normalizePhotoMatchKey(file.name);
                newEntries.set(key, { dataUrl, fileName: file.name });
              }
              resolve();
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(file);
          })
      )
    );

    setPhotoPool(newEntries);

    let newlyMatchedCount = 0;
    setStudents((prev) =>
      prev.map((student) => {
        const key = normalizePhotoMatchKey(student.studentNumber);
        const match = newEntries.get(key);
        if (match) {
          newlyMatchedCount++;
          return {
            ...student,
            photoDataUrl: match.dataUrl,
            photoFileName: match.fileName,
          };
        }
        return student;
      })
    );

    setStatusBanner({
      type: 'success',
      message: `${files.length} adet fotoğraf yüklendi. Okul numarasına göre ${newlyMatchedCount} öğrenciyle otomatik eşleştirildi.`,
    });
    e.target.value = '';
  };

  // Single student photo upload override
  const handleSingleStudentPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !singlePhotoTargetStudentId) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === singlePhotoTargetStudentId) {
            const key = normalizePhotoMatchKey(s.studentNumber);
            setPhotoPool((pool) => {
              const next = new Map(pool);
              next.set(key, { dataUrl, fileName: file.name });
              return next;
            });
            return { ...s, photoDataUrl: dataUrl, photoFileName: file.name };
          }
          return s;
        })
      );
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Custom Front Template Background Image Upload
  const handleCustomTemplateBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      updateActiveTemplate((prev) => ({
        ...prev,
        customBackgroundUrl: dataUrl,
      }));
      setEditingSide('front');
      setStatusBanner({
        type: 'success',
        message: `"${file.name}" ön yüz kart arka plan şablonu olarak yüklendi.`,
      });
      setActiveTab('template-studio');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Custom Back Template Background Image Upload
  const handleCustomBackBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      handleToggleBackSide(true);
      updateActiveTemplate((prev) => ({
        ...prev,
        enableBackSide: true,
        customBackBackgroundUrl: dataUrl,
      }));
      setEditingSide('back');
      setStatusBanner({
        type: 'success',
        message: `"${file.name}" arka yüz şablon görseli olarak yüklendi.`,
      });
      setActiveTab('template-studio');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // School Logo Upload
  const handleSchoolLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      updateActiveTemplate((prev) => ({
        ...prev,
        schoolLogoUrl: dataUrl,
      }));
      setStatusBanner({
        type: 'success',
        message: 'Okul logosu şablona eklendi.',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Principal Signature / Seal Image Upload (for Back Side)
  const handlePrincipalSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      updateActiveTemplate((prev) => ({
        ...prev,
        principalSignatureUrl: dataUrl,
      }));
      setStatusBanner({
        type: 'success',
        message: 'Okul müdürü imza/mühür görseli arka yüz şablonuna eklendi.',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Apply Global School Name & Grade-Based Validity Period (Dönem) to all rows
  const handleApplyGlobalSchoolToAll = () => {
    setStudents((prev) =>
      prev.map((s) => {
        const { formattedStudentNumber, fieldOfStudy } = inferDepartmentAndStudentNumber(
          s.studentNumber,
          s.className,
          s.fieldOfStudy
        );
        return {
          ...s,
          studentNumber: formattedStudentNumber,
          fieldOfStudy: s.fieldOfStudy || fieldOfStudy,
          schoolName: combinedGlobalSchoolName,
          academicYear: calculateValidityPeriodByClass(s.className, globalAcademicYear),
        };
      })
    );
    updateActiveTemplate((prev) => ({
      ...prev,
      defaultSchoolName: combinedGlobalSchoolName.toUpperCase(),
      defaultAcademicYear: globalAcademicYear,
    }));
    setStatusBanner({
      type: 'info',
      message: `Tüm öğrencilerin okul adı, AMP/ATP önadları, alan bilgileri ve sınıfa göre geçerlilik dönemleri otomatik güncellendi.`,
    });
  };

  // Add single student manually
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.studentNumber.trim() || !newStudent.fullName.trim()) return;

    const cleanNo = newStudent.studentNumber.trim();
    const cleanClass = newStudent.className.trim() || 'AMP 9-A';
    const { formattedStudentNumber, fieldOfStudy } = inferDepartmentAndStudentNumber(
      cleanNo,
      cleanClass,
      newStudent.fieldOfStudy
    );

    const matchedPhoto =
      photoPool.get(normalizePhotoMatchKey(cleanNo)) ||
      photoPool.get(normalizePhotoMatchKey(formattedStudentNumber));

    const record: StudentRecord = {
      id: `std-${Date.now()}`,
      studentNumber: formattedStudentNumber,
      fullName: newStudent.fullName.trim(),
      className: cleanClass,
      fieldOfStudy,
      schoolName: newStudent.schoolName.trim() || combinedGlobalSchoolName,
      academicYear: calculateValidityPeriodByClass(cleanClass, globalAcademicYear),
      bloodType: 'A Rh(+)',
      emergencyPhone: '0532 000 00 00',
      photoDataUrl: matchedPhoto?.dataUrl,
      photoFileName: matchedPhoto?.fileName,
    };

    setStudents((prev) => [record, ...prev]);
    setNewStudent({
      studentNumber: '',
      fullName: '',
      className: newStudent.className,
      fieldOfStudy: '',
      schoolName: combinedGlobalSchoolName,
    });
  };

  // Update inline student field
  const handleUpdateStudentField = (
    id: string,
    field: keyof StudentRecord,
    value: string
  ) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        if (field === 'studentNumber') {
          const match = photoPool.get(normalizePhotoMatchKey(value));
          if (match) {
            updated.photoDataUrl = match.dataUrl;
            updated.photoFileName = match.fileName;
          }
        } else if (field === 'className') {
          // Automatically recalculate validity period when student's class grade changes (9->4yr, 10->3yr, 11->2yr, 12->1yr)
          updated.academicYear = calculateValidityPeriodByClass(value, globalAcademicYear);
          // Also infer AMP/ATP prefix and field of study if not customized
          const inferred = inferDepartmentAndStudentNumber(
            updated.studentNumber,
            value,
            updated.fieldOfStudy
          );
          updated.studentNumber = inferred.formattedStudentNumber;
          if (!updated.fieldOfStudy || updated.fieldOfStudy === 'Genel Lise Programı') {
            updated.fieldOfStudy = inferred.fieldOfStudy;
          }
        }
        return updated;
      })
    );
  };

  const handleDeleteStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  // Dynamically generate visitor & staff card lists using active template settings
  const currentVisitorList = useMemo(() => {
    return generateVisitorCards(visitorCardCount, {
      schoolName: combinedGlobalSchoolName,
      prefix: visitorCardPrefix,
      title: visitorCardTitle,
      subtitle: visitorCardSubtitle,
    });
  }, [
    visitorCardCount,
    combinedGlobalSchoolName,
    visitorCardPrefix,
    visitorCardTitle,
    visitorCardSubtitle,
  ]);

  const currentStaffList = useMemo(() => {
    return generateStaffCards(staffCardCount, {
      schoolName: combinedGlobalSchoolName,
      prefix: staffCardPrefix,
      title: staffCardTitle,
      subtitle: staffCardSubtitle,
      validity: globalAcademicYear,
    });
  }, [
    staffCardCount,
    combinedGlobalSchoolName,
    staffCardPrefix,
    staffCardTitle,
    staffCardSubtitle,
    globalAcademicYear,
  ]);

  // Export Visitor or Staff cards directly to PDF
  const handleExportVisitorOrStaffPdf = async (type: 'visitor' | 'staff') => {
    const list = type === 'visitor' ? currentVisitorList : currentStaffList;
    if (list.length === 0 || isExportingPdf) return;

    setIsExportingPdf(true);
    setExportProgress({ current: 0, total: list.length });

    try {
      await generateBatchStudentCardsPdf(
        list,
        activeTemplate,
        {
          ...pdfSettings,
          includeBackSide: activeTemplate.enableBackSide,
        },
        (current, total) => {
          setExportProgress({ current, total });
        }
      );
      setStatusBanner({
        type: 'success',
        message: `${list.length} adet ${
          type === 'visitor' ? 'Ziyaretçi' : 'Görevli'
        } Kartı PDF olarak başarıyla indirildi.`,
      });
    } catch {
      setStatusBanner({
        type: 'warning',
        message: 'PDF oluşturulurken bir hata meydana geldi.',
      });
    } finally {
      setIsExportingPdf(false);
      setExportProgress(null);
    }
  };

  // Append generated Visitor or Staff cards to main student cards list
  const handleAppendVisitorCardsToStudents = (type: 'visitor' | 'staff') => {
    const list = type === 'visitor' ? currentVisitorList : currentStaffList;
    setStudents((prev) => [...prev, ...list]);
    setStatusBanner({
      type: 'success',
      message: `${list.length} adet ${
        type === 'visitor' ? 'Ziyaretçi' : 'Görevli'
      } Kartı ana listeye aktarıldı. Toplu Önizleme sekmesinden tüm kartları görebilirsiniz.`,
    });
  };

  // Trigger Batch PDF Export
  const handleExportBatchPdf = async () => {
    if (students.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    setExportProgress({ current: 0, total: students.length });

    try {
      await generateBatchStudentCardsPdf(
        students,
        activeTemplate,
        {
          ...pdfSettings,
          includeBackSide: activeTemplate.enableBackSide,
        },
        (current, total) => {
          setExportProgress({ current, total });
        }
      );
      setStatusBanner({
        type: 'success',
        message: `${students.length} öğrencinin ${
          activeTemplate.enableBackSide ? 'çift taraflı (ön + arka yüz)' : 'tek taraflı (ön yüz)'
        } kimlik kartı PDF olarak indirildi.`,
      });
    } catch {
      setStatusBanner({
        type: 'warning',
        message: 'PDF oluşturulurken bir hata meydana geldi.',
      });
    } finally {
      setIsExportingPdf(false);
      setExportProgress(null);
    }
  };

  const previewStudent = students[previewStudentIndex] ||
    students[0] || {
      id: 'preview',
      studentNumber: '1042',
      fullName: 'Örnek Öğrenci',
      className: '10-A',
      schoolName: combinedGlobalSchoolName,
      academicYear: globalAcademicYear,
      bloodType: 'A Rh(+)',
      emergencyPhone: '0532 111 22 33',
    };

  const activeSelectedFieldKey: FieldKey =
    editingSide === 'back' ? selectedBackField : selectedFrontField;

  const currentFieldConfig: FieldPosition =
    editingSide === 'back'
      ? activeTemplate.backFields[selectedBackField]
      : activeTemplate.fields[selectedFrontField];

  const updateCurrentSelectedField = (patch: Partial<FieldPosition>) => {
    if (editingSide === 'back') {
      updateActiveTemplate((prev) => ({
        ...prev,
        backFields: {
          ...prev.backFields,
          [selectedBackField]: {
            ...prev.backFields[selectedBackField],
            ...patch,
          },
        },
      }));
    } else {
      updateActiveTemplate((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          [selectedFrontField]: {
            ...prev.fields[selectedFrontField],
            ...patch,
          },
        },
      }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Hidden File Inputs */}
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleExcelUpload}
        className="hidden"
      />
      <input
        ref={photosInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleBatchPhotosUpload}
        className="hidden"
      />
      <input
        ref={customTemplateBgInputRef}
        type="file"
        accept="image/*"
        onChange={handleCustomTemplateBgUpload}
        className="hidden"
      />
      <input
        ref={customBackBgInputRef}
        type="file"
        accept="image/*"
        onChange={handleCustomBackBgUpload}
        className="hidden"
      />
      <input
        ref={schoolLogoInputRef}
        type="file"
        accept="image/*"
        onChange={handleSchoolLogoUpload}
        className="hidden"
      />
      <input
        ref={principalSigInputRef}
        type="file"
        accept="image/*"
        onChange={handlePrincipalSignatureUpload}
        className="hidden"
      />
      <input
        ref={singleRowPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleSingleStudentPhotoChange}
        className="hidden"
      />

      {/* Top Bar Contract: Zone 1 (Brand), Zone 2 (Navigation Links), Zone 3 (Primary Actions) */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('data-matching');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap"
        >
          KampüsKart
        </a>

        {/* Zone 2: Clean navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('data-matching')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'data-matching'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            1. Veri & Fotoğraf Eşleştirme
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('template-studio')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'template-studio'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            2. Şablon & Yerleşim Stüdyosu (Ön/Arka)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('visitor-staff')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'visitor-staff'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            3. Ziyaretçi & Görevli Kartları
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batch-preview')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'batch-preview'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            4. Toplu Önizleme & A4 Baskı ({students.length})
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => downloadSampleExcelFile(INITIAL_STUDENTS)}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            Örnek Excel İndir
          </button>
          <button
            type="button"
            disabled={isExportingPdf || students.length === 0}
            onClick={handleExportBatchPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isExportingPdf && exportProgress
              ? `PDF Hazırlanıyor (${exportProgress.current}/${exportProgress.total})`
              : `Toplu PDF İndir (${students.length} ${activeTemplate.enableBackSide ? 'Çift Yön' : 'Kart'})`}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="flex md:hidden items-center justify-around bg-white border-b border-slate-200 px-2 py-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('data-matching')}
          className={`px-2.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
            activeTab === 'data-matching'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600'
          }`}
        >
          1. Veri
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('template-studio')}
          className={`px-2.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
            activeTab === 'template-studio'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600'
          }`}
        >
          2. Şablon
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('visitor-staff')}
          className={`px-2.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
            activeTab === 'visitor-staff'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600'
          }`}
        >
          3. Ziyaretçi/Görevli
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('batch-preview')}
          className={`px-2.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
            activeTab === 'batch-preview'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600'
          }`}
        >
          4. Baskı ({students.length})
        </button>
      </div>

      {/* Contextual Status Notification Banner */}
      {statusBanner && (
        <div
          className={`px-6 py-3 border-b flex items-center justify-between text-xs font-medium ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusBanner.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{statusBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-500 hover:text-slate-800 font-semibold ml-4 whitespace-nowrap"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {/* Top Summary Strip & Quick Batch Actions */}
        <section className="mb-6 pb-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Toplu Öğrenci Kimlik Kartı Üretim Merkezi
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
              <span>Toplam {students.length} Öğrenci Kaydı</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">
                {matchedPhotosCount} Fotoğraf Eşleşti
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  missingPhotosCount > 0
                    ? 'text-amber-700 font-medium'
                    : 'text-slate-500'
                }
              >
                {missingPhotosCount} Fotoğraf Bekleniyor
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Baskı Modu:{' '}
                <strong className="text-slate-900">
                  {activeTemplate.enableBackSide
                    ? 'Çift Taraflı (Ön + Arka Yüz)'
                    : 'Tek Taraflı (Sadece Ön Yüz)'}
                </strong>
              </span>
            </div>
          </div>

          {/* Global School Settings Inline Form (2-Line School Name Support) */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Okul İsmi (2 Satır):
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={globalSchoolLine1}
                  onChange={(e) => setGlobalSchoolLine1(e.target.value)}
                  placeholder="1. Satır (Örn: T.C. MEB / Valilik)"
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 w-38"
                />
                <input
                  type="number"
                  min={10}
                  max={38}
                  value={activeTemplate.fields.schoolName.fontSize}
                  onChange={(e) => {
                    const val = Math.max(10, Math.min(38, parseInt(e.target.value, 10) || 18));
                    updateActiveTemplate((prev) => ({
                      ...prev,
                      fields: {
                        ...prev.fields,
                        schoolName: {
                          ...prev.fields.schoolName,
                          fontSize: val,
                        },
                      },
                    }));
                  }}
                  title="1. Satır Yazı Boyutu (px)"
                  className="w-12 px-1 py-1.5 text-xs font-mono text-center border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <div
                  className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200"
                  title="1. Satır Hizalaması (Sol / Orta / Sağ)"
                >
                  {(['left', 'center', 'right'] as const).map((alignOpt) => {
                    const currentAlign = activeTemplate.fields.schoolName.align || 'center';
                    const defaultXForAlign =
                      alignOpt === 'left'
                        ? activeTemplate.id === 'modern-campus'
                          ? 16.5
                          : 18
                        : alignOpt === 'center'
                        ? 52
                        : 92;
                    return (
                      <button
                        key={alignOpt}
                        type="button"
                        onClick={() =>
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            fields: {
                              ...prev.fields,
                              schoolName: {
                                ...prev.fields.schoolName,
                                align: alignOpt,
                                x: defaultXForAlign,
                              },
                            },
                          }))
                        }
                        className={`px-1.5 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                          currentAlign === alignOpt
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {alignOpt === 'left' ? 'Sol' : alignOpt === 'center' ? 'Orta' : 'Sağ'}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={globalSchoolLine2}
                  onChange={(e) => setGlobalSchoolLine2(e.target.value)}
                  placeholder="2. Satır (Örn: Atatürk Fen Lisesi)"
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 w-38"
                />
                <input
                  type="number"
                  min={10}
                  max={42}
                  value={
                    activeTemplate.fields.schoolName.secondLineFontSize ??
                    activeTemplate.fields.schoolName.fontSize
                  }
                  onChange={(e) => {
                    const val = Math.max(10, Math.min(42, parseInt(e.target.value, 10) || 22));
                    updateActiveTemplate((prev) => ({
                      ...prev,
                      fields: {
                        ...prev.fields,
                        schoolName: {
                          ...prev.fields.schoolName,
                          secondLineFontSize: val,
                        },
                      },
                    }));
                  }}
                  title="2. Satır Yazı Boyutu (px)"
                  className="w-12 px-1 py-1.5 text-xs font-mono text-center border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <div
                  className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200"
                  title="2. Satır Hizalaması (Sol / Orta / Sağ)"
                >
                  {(['left', 'center', 'right'] as const).map((alignOpt) => {
                    const currentSecondAlign =
                      activeTemplate.fields.schoolName.secondLineAlign ??
                      activeTemplate.fields.schoolName.align ??
                      'center';
                    const defaultXForAlign =
                      alignOpt === 'left'
                        ? activeTemplate.id === 'modern-campus'
                          ? 16.5
                          : 18
                        : alignOpt === 'center'
                        ? 52
                        : 92;
                    return (
                      <button
                        key={alignOpt}
                        type="button"
                        onClick={() =>
                          updateActiveTemplate((prev) => ({
                            ...prev,
                            fields: {
                              ...prev.fields,
                              schoolName: {
                                ...prev.fields.schoolName,
                                secondLineAlign: alignOpt,
                                secondLineX: defaultXForAlign,
                              },
                            },
                          }))
                        }
                        className={`px-1.5 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                          currentSecondAlign === alignOpt
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {alignOpt === 'left' ? 'Sol' : alignOpt === 'center' ? 'Orta' : 'Sağ'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label
                className="text-xs font-medium text-slate-600 whitespace-nowrap"
                title="Başlangıç yılına göre 9. sınıflar +4 yıl, 10. sınıflar +3 yıl, 11. sınıflar +2 yıl, 12. sınıflar +1 yıl olarak otomatik hesaplanır"
              >
                Başlangıç Yılı:
              </label>
              <input
                type="text"
                value={globalAcademicYear}
                onChange={(e) => setGlobalAcademicYear(e.target.value)}
                placeholder="2026"
                className="px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 w-24"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyGlobalSchoolToAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Okul adını ve sınıfa göre 4/3/2/1 yıllık geçerlilik dönemlerini tüm öğrencilere uygula"
            >
              Tümüne Uygula (Sınıfa Göre Dönem)
            </button>
          </div>
        </section>

        {/* TAB 1: VERİ & FOTOĞRAF EŞLEŞTİRME */}
        {activeTab === 'data-matching' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 7 Columns: Upload Dropzones + Student Data Grid */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step-by-Step Batch Ingestion Action Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Excel / CSV Upload */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-700">
                        01. Öğrenci Listesi
                      </span>
                      <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Excel veya CSV Yükle
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Okul numarası, adı soyadı, sınıfı, okul ismi ve kan grubu sütunlarını otomatik tanır.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => excelInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Excel / CSV Seç
                    </button>
                  </div>
                </div>

                {/* 2. Batch Photos Upload (Named by Student Number) */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-700">
                        02. Toplu Fotoğraflar
                      </span>
                      <FolderUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Numaralı Fotoğrafları Seç
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Okul numarasıyla isimlendirilmiş (<span className="font-mono text-slate-700">1042.jpg</span>, <span className="font-mono text-slate-700">1045.png</span>) tüm fotoğrafları tek seferde seçin.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => photosInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Fotoğrafları Yükle ({photoPool.size})
                    </button>
                  </div>
                </div>

                {/* 3. Template Selection or Custom Upload */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-700">
                        03. Ön & Arka Yüz Şablonu
                      </span>
                      <Sparkles className="w-4 h-4 text-blue-600" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Tek veya Çift Taraflı Tasarım
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      İsteğe bağlı arka yüz (öğrenci imzası, okul iletişim bilgileri) desteğini aktif edin.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => customTemplateBgInputRef.current?.click()}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Şablon Yükle
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('template-studio')}
                      className="inline-flex items-center justify-center px-2.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Ön/Arka Düzenle
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Table & Filter Controls */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Okul no, öğrenci adı veya sınıf ara..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {/* Interactive Filter Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg border-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="all">Tüm Sınıflar ({students.length})</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          Sınıf: {cls}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setPhotoFilter('all')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          photoFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tümü
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFilter('matched')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          photoFilter === 'matched'
                            ? 'bg-white text-emerald-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Fotoğraflı ({matchedPhotosCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFilter('missing')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          photoFilter === 'missing'
                            ? 'bg-white text-amber-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Eksik ({missingPhotosCount})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Manual Student Addition Form */}
                <form
                  onSubmit={handleAddStudent}
                  className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap sm:flex-nowrap items-center gap-2"
                >
                  <span className="text-xs font-semibold text-slate-600 whitespace-nowrap flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                    Hızlı Ekle:
                  </span>
                  <input
                    type="text"
                    value={newStudent.studentNumber}
                    onChange={(e) =>
                      setNewStudent((p) => ({ ...p, studentNumber: e.target.value }))
                    }
                    placeholder="Okul No (Örn: 1205)"
                    className="w-28 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={newStudent.fullName}
                    onChange={(e) =>
                      setNewStudent((p) => ({ ...p, fullName: e.target.value }))
                    }
                    placeholder="Adı Soyadı"
                    className="flex-1 min-w-[130px] px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={newStudent.fieldOfStudy}
                    onChange={(e) =>
                      setNewStudent((p) => ({ ...p, fieldOfStudy: e.target.value }))
                    }
                    placeholder="Alanı (Örn: Bilişim)"
                    title="Kart üzerinde basılacak alan / bölüm"
                    className="w-36 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={newStudent.className}
                    onChange={(e) =>
                      setNewStudent((p) => ({ ...p, className: e.target.value }))
                    }
                    placeholder="Sınıf (AMP 9-A)"
                    title="Dönem ve alan belirleme referansıdır, karta basılmaz"
                    className="w-24 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Listeye Ekle
                  </button>
                </form>

                {/* High-Density Student Data Grid */}
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <tr>
                        <th className="py-2.5 pl-4 pr-2 w-14">Foto</th>
                        <th className="py-2.5 px-2 w-24">Okul No</th>
                        <th className="py-2.5 px-2">Adı Soyadı</th>
                        <th className="py-2.5 px-2 w-36" title="Kart üzerine basılan alan/bölüm bilgisi (Sınıf yerine basılır)">Alanı / Bölümü (Kartta Yazar)</th>
                        <th className="py-2.5 px-2 w-20" title="Arka planda dönem ve alan belirlemede referans olarak kullanılır">Sınıfı</th>
                        <th className="py-2.5 px-2 w-36">Dönem (Geçerlilik)</th>
                        <th className="py-2.5 px-2">Okul İsmi (2 Satır)</th>
                        <th className="py-2.5 pl-2 pr-4 text-right w-24">Durum / İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            Kriterlere uygun öğrenci kaydı bulunamadı. Yukarıdan Excel yükleyebilir veya yeni öğrenci ekleyebilirsiniz.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => {
                          const realIndex = students.findIndex((s) => s.id === student.id);
                          const isSelectedForPreview = realIndex === previewStudentIndex;

                          return (
                            <tr
                              key={student.id}
                              onClick={() => {
                                if (realIndex !== -1) setPreviewStudentIndex(realIndex);
                              }}
                              className={`group transition-colors cursor-pointer ${
                                isSelectedForPreview
                                  ? 'bg-blue-50/70'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {/* Photo Cell */}
                              <td className="py-2 pl-4 pr-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSinglePhotoTargetStudentId(student.id);
                                    singleRowPhotoInputRef.current?.click();
                                  }}
                                  title="Fotoğrafı değiştirmek için tıklayın"
                                  className="relative w-9 h-11 rounded overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center group/photo"
                                >
                                  {student.photoDataUrl ? (
                                    <img
                                      src={student.photoDataUrl}
                                      alt={student.fullName}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="w-4 h-4 text-slate-400" />
                                  )}
                                  <span className="absolute inset-0 bg-black/50 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center text-[9px] text-white font-semibold">
                                    Seç
                                  </span>
                                </button>
                              </td>

                              {/* Student Number (Tabular Monospace) */}
                              <td className="py-2 px-2 font-mono tabular-nums">
                                <input
                                  type="text"
                                  value={student.studentNumber}
                                  onChange={(e) =>
                                    handleUpdateStudentField(
                                      student.id,
                                      'studentNumber',
                                      e.target.value
                                    )
                                  }
                                  className="w-18 px-1.5 py-1 font-semibold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-white rounded focus:outline-none"
                                />
                              </td>

                              {/* Full Name */}
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={student.fullName}
                                  onChange={(e) =>
                                    handleUpdateStudentField(
                                      student.id,
                                      'fullName',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1.5 py-1 font-medium text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-white rounded focus:outline-none"
                                />
                              </td>

                               {/* Field of Study (Alanı) - Prints on card instead of class name */}
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={student.fieldOfStudy || ''}
                                  onChange={(e) =>
                                    handleUpdateStudentField(
                                      student.id,
                                      'fieldOfStudy',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Örn: Bilişim Alanı"
                                  title="Kart üzerinde basılan alan/bölüm bilgisi"
                                  className="w-36 px-1.5 py-1 font-semibold text-blue-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-white rounded focus:outline-none"
                                />
                              </td>

                              {/* Class Name (Reference) */}
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={student.className}
                                  onChange={(e) =>
                                    handleUpdateStudentField(
                                      student.id,
                                      'className',
                                      e.target.value
                                    )
                                  }
                                  title="Dönem ve alan belirleme referansı (Karta basılmaz)"
                                  className="w-18 px-1.5 py-1 text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-white rounded focus:outline-none"
                                />
                              </td>

                              {/* Validity Period (Dönem - Auto calculated by grade: 9->4yr, 10->3yr, 11->2yr, 12->1yr) */}
                              <td className="py-2 px-2 font-mono tabular-nums">
                                <input
                                  type="text"
                                  value={student.academicYear || ''}
                                  onChange={(e) =>
                                    handleUpdateStudentField(
                                      student.id,
                                      'academicYear',
                                      e.target.value
                                    )
                                  }
                                  title="9. Sınıf: 4 Yıl | 10. Sınıf: 3 Yıl | 11. Sınıf: 2 Yıl | 12. Sınıf: 1 Yıl"
                                  className="w-34 px-1.5 py-1 text-[11px] font-medium text-blue-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-white rounded focus:outline-none"
                                />
                              </td>

                              {/* School Name (2-Line Editable) */}
                              <td className="py-2 px-2">
                                <textarea
                                  rows={2}
                                  value={student.schoolName}
                                  onChange={(e) =>
                                    handleUpdateStudentField(
                                      student.id,
                                      'schoolName',
                                      e.target.value
                                    )
                                  }
                                  placeholder="1. Satır&#10;2. Satır"
                                  className="w-full px-1.5 py-1 text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-white rounded focus:outline-none resize-none leading-tight"
                                />
                              </td>

                              {/* Photo Match Status + Delete */}
                              <td className="py-2 pl-2 pr-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  {student.photoDataUrl ? (
                                    <span
                                      className="text-[11px] font-mono text-emerald-700"
                                      title={`Eşleşen dosya: ${student.photoFileName || `${student.studentNumber}.jpg`}`}
                                    >
                                      {student.studentNumber}.jpg ✓
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-mono text-amber-700">
                                      Foto Eksik
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteStudent(student.id);
                                    }}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                    title="Öğrenciyi Sil"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Satıra tıklayarak sağ tarafta öğrencinin canlı kimlik kartını (ön ve arka yüz) inceleyebilirsiniz.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStudents(INITIAL_STUDENTS);
                      setPreviewStudentIndex(0);
                    }}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Örnek Verileri Sıfırla
                  </button>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Live Card Preview (Front & Optional Back) + Quick Template Switcher + Direct Export */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-blue-700">
                      Canlı Kimlik Kartı Önizlemesi
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {previewStudent.fullName} ({previewStudent.studentNumber})
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewStudentIndex((i) =>
                          i > 0 ? i - 1 : Math.max(0, students.length - 1)
                        )
                      }
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                    >
                      Önceki
                    </button>
                    <span className="text-xs font-mono text-slate-500 px-1 tabular-nums">
                      {students.length > 0 ? previewStudentIndex + 1 : 0}/{students.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewStudentIndex((i) =>
                          i < students.length - 1 ? i + 1 : 0
                        )
                      }
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                    >
                      Sonraki
                    </button>
                  </div>
                </div>

                {/* Optional Back Side Toggle & Front/Back View Switcher */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.enableBackSide}
                      onChange={(e) => handleToggleBackSide(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span>Arka Yüz Tasarımını Kullan (Çift Taraflı Kart)</span>
                  </label>

                  {activeTemplate.enableBackSide && (
                    <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setEditingSide('front')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          editingSide === 'front'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Ön Yüz
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSide('back')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          editingSide === 'back'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Arka Yüz
                      </button>
                    </div>
                  )}
                </div>

                {/* High-Res Canvas Card Preview */}
                <div className="flex flex-col items-center justify-center bg-slate-100/80 p-4 rounded-xl border border-slate-200/70">
                  <CardCanvasPreview
                    student={previewStudent}
                    template={activeTemplate}
                    side={activeTemplate.enableBackSide ? editingSide : 'front'}
                    className={
                      activeTemplate.orientation === 'landscape'
                        ? 'w-full max-w-[440px]'
                        : 'w-full max-w-[280px]'
                    }
                  />
                  {activeTemplate.enableBackSide && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingSide((s) => (s === 'front' ? 'back' : 'front'))
                      }
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" />
                      {editingSide === 'front'
                        ? 'Arka Yüzü Görüntüle (İmza & İletişim)'
                        : 'Ön Yüzü Görüntüle (Fotoğraf & Kimlik)'}
                    </button>
                  )}
                </div>

                {/* Quick Template Switcher */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-xs font-bold text-slate-800">
                      Hazır Şablon Seçimi veya Özel Şablon
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('template-studio')}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      Ön/Arka Alanları Özelleştir
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {templates.map((tpl) => {
                      const isActive = tpl.id === activeTemplate.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => setActiveTemplateId(tpl.id)}
                          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                            isActive
                              ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: tpl.primaryColor }}
                            />
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {tpl.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                            {tpl.orientation === 'landscape' ? 'Yatay CR80' : 'Dikey Yaka Kartı'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Batch PDF Settings & Action Box */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">PDF Sayfa Düzeni:</span>
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() =>
                          setPdfSettings((s) => ({ ...s, layoutMode: 'a4-grid' }))
                        }
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          pdfSettings.layoutMode === 'a4-grid'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        A4 Çoklu Dizilim ({activeTemplate.orientation === 'landscape' ? '10 Kart/Sayfa' : '9 Kart/Sayfa'})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPdfSettings((s) => ({ ...s, layoutMode: 'single-card' }))
                        }
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          pdfSettings.layoutMode === 'single-card'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Tekli PVC Yazıcı (CR80)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfSettings.showCropMarks}
                        onChange={(e) =>
                          setPdfSettings((s) => ({
                            ...s,
                            showCropMarks: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>A4 baskıda kesim çizgilerini (kros) göster</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('batch-preview')}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Tüm Kartları Gör
                    </button>
                  </div>

                  {/* Quick Watermark Toggle in Tab 1 */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeWatermark.enabled}
                        onChange={(e) => updateWatermark({ enabled: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>Filigran Ekle ({activeWatermark.type === 'logo' ? 'Okul Logosu' : `'${activeWatermark.text || 'ÖRNEK'}'`})</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={activeWatermark.type}
                        onChange={(e) =>
                          updateWatermark({
                            enabled: true,
                            type: e.target.value as 'logo' | 'text',
                          })
                        }
                        className="px-2 py-1 text-[11px] font-medium bg-white border border-slate-200 rounded-md text-slate-700"
                      >
                        <option value="logo">Okul Logosu Filigranı</option>
                        <option value="text">Metin (&apos;ÖRNEK&apos; vb.)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setActiveTab('template-studio')}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      >
                        Filigran Ayarları
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isExportingPdf || students.length === 0}
                    onClick={handleExportBatchPdf}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileCheck className="w-4 h-4" />
                    {isExportingPdf && exportProgress
                      ? `PDF Oluşturuluyor: ${exportProgress.current} / ${exportProgress.total} Öğrenci...`
                      : `${students.length} Öğrenci İçin ${
                          activeTemplate.enableBackSide
                            ? 'Çift Taraflı (Ön+Arka) '
                            : 'Tek Seferde '
                        }Toplu PDF İndir`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ŞABLON & YERLEŞİM STÜDYOSU (FRONT & BACK DRAG & DROP) */}
        {activeTab === 'template-studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 7 Columns: Interactive Drag-and-Drop Canvas for Front or Back */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                {/* Top Controls: Optional Back Side Toggle + Side Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setEditingSide('front')}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          editingSide === 'front'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Ön Yüz Tasarımı
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!activeTemplate.enableBackSide) {
                            handleToggleBackSide(true);
                          } else {
                            setEditingSide('back');
                          }
                        }}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          editingSide === 'back'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Arka Yüz Tasarımı {activeTemplate.enableBackSide ? '(Aktif)' : '(Opsiyonel)'}
                      </button>
                    </div>
                  </div>

                  {/* Enable / Disable Back Side Checkbox */}
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate.enableBackSide}
                      onChange={(e) => handleToggleBackSide(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span>Arka Yüzü PDF Baskıya Dahil Et (İsteğe Bağlı)</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="text-xs font-semibold text-blue-700">
                      {editingSide === 'front'
                        ? 'Ön Yüz İnteraktif Şablon Tuvali'
                        : 'Arka Yüz İnteraktif Şablon Tuvali (İmza & Okul İletişim)'}
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      {editingSide === 'front'
                        ? 'Ön Yüz Bilgilerini Fareyle Sürükleyerek Yerleştirin'
                        : 'Arka Yüz Alanlarını (Öğrenci İmzası, Okul İletişim, Müdür Onayı) Sürükleyin'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingSide === 'front' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => customTemplateBgInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Ön Yüz Özel Şablon Yükle
                        </button>
                        {activeTemplate.customBackgroundUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveTemplate((prev) => ({
                                ...prev,
                                customBackgroundUrl: undefined,
                              }))
                            }
                            className="px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Kaldır
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => customBackBgInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Arka Yüz Özel Şablon Yükle
                        </button>
                        <button
                          type="button"
                          onClick={() => principalSigInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {activeTemplate.principalSignatureUrl
                            ? 'Müdür İmza/Mühür Değiştir'
                            : '+ Müdür İmza/Mühür Görseli'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-slate-100 border border-slate-200/80 rounded-xl p-6 min-h-[380px]">
                  <CardCanvasPreview
                    student={previewStudent}
                    template={activeTemplate}
                    side={editingSide}
                    selectedField={activeSelectedFieldKey}
                    interactive={true}
                    onSelectField={(field) => {
                      if (editingSide === 'back') {
                        setSelectedBackField(field as BackFieldKey);
                      } else {
                        setSelectedFrontField(field as FrontFieldKey);
                      }
                    }}
                    onMoveField={(field, newX, newY) => {
                      if (editingSide === 'back') {
                        const bf = field as BackFieldKey;
                        updateActiveTemplate((prev) => ({
                          ...prev,
                          backFields: {
                            ...prev.backFields,
                            [bf]: {
                              ...prev.backFields[bf],
                              x: newX,
                              y: newY,
                            },
                          },
                        }));
                      } else {
                        const ff = field as FrontFieldKey;
                        updateActiveTemplate((prev) => {
                          const existingField = prev.fields[ff];
                          const deltaX = newX - existingField.x;
                          const nextSecondLineX =
                            ff === 'schoolName'
                              ? Math.max(
                                  1,
                                  Math.min(
                                    96,
                                    Math.round(
                                      ((existingField.secondLineX ?? existingField.x) + deltaX) * 2
                                    ) / 2
                                  )
                                )
                              : existingField.secondLineX;
                          return {
                            ...prev,
                            fields: {
                              ...prev.fields,
                              [ff]: {
                                ...existingField,
                                x: newX,
                                y: newY,
                                ...(ff === 'schoolName' ? { secondLineX: nextSecondLineX } : {}),
                              },
                            },
                          };
                        });
                      }
                    }}
                    className={
                      activeTemplate.orientation === 'landscape'
                        ? 'w-full max-w-[560px]'
                        : 'w-full max-w-[340px]'
                    }
                  />
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    {editingSide === 'front'
                      ? 'Ön Yüz: Fotoğraf, Adı Soyadı, Okul No, Sınıf veya 2 Satırlı Okul İsmi alanlarına tıklayıp sürükleyebilirsiniz.'
                      : 'Arka Yüz: Öğrenci İmzası kutusu, Okul Adresi, Telefon, Bulunması Halinde Uyarı metni ve Müdür Onay kutusunu sürükleyerek hizalayabilirsiniz.'}
                  </p>
                </div>

                {/* Template Presets & Colors */}
                <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Kart Yönü (CR80 Standart)
                    </label>
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveTemplate((p) => ({
                            ...p,
                            orientation: 'landscape',
                          }))
                        }
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                          activeTemplate.orientation === 'landscape'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Yatay (85.6×54mm)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveTemplate((p) => ({
                            ...p,
                            orientation: 'portrait',
                          }))
                        }
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                          activeTemplate.orientation === 'portrait'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Dikey (54×85.6mm)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Kurumsal Renkler & Okul Logosu (PNG)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeTemplate.primaryColor}
                        onChange={(e) =>
                          updateActiveTemplate((p) => ({
                            ...p,
                            primaryColor: e.target.value,
                          }))
                        }
                        title="Ana Tema Rengi"
                        className="w-9 h-8 rounded border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="color"
                        value={activeTemplate.accentColor}
                        onChange={(e) =>
                          updateActiveTemplate((p) => ({
                            ...p,
                            accentColor: e.target.value,
                          }))
                        }
                        title="Vurgu Rengi"
                        className="w-9 h-8 rounded border border-slate-200 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => schoolLogoInputRef.current?.click()}
                        className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        {activeTemplate.schoolLogoUrl ? 'Logoyu Değiştir' : '+ Okul Logosu (PNG)'}
                      </button>
                      {activeTemplate.schoolLogoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveTemplate((p) => ({
                              ...p,
                              schoolLogoUrl: undefined,
                            }))
                          }
                          className="p-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Logoyu Kaldır"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Logo Clarity / Contrast Badge Controls */}
                    {activeTemplate.schoolLogoUrl && (
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-900">
                            Logo Rozet Görünümü:
                          </span>
                          <div className="flex items-center bg-white rounded border border-blue-200 p-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateActiveTemplate((p) => ({
                                  ...p,
                                  schoolLogoStyle: 'badge',
                                }))
                              }
                              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                                (activeTemplate.schoolLogoStyle ?? 'badge') === 'badge'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Şeffaf PNG amblemlerin koyu başlık zemininde kaybolmaması için arkasına beyaz dairesel kontrast rozet ekler"
                            >
                              Beyaz Rozet (Net)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateActiveTemplate((p) => ({
                                  ...p,
                                  schoolLogoStyle: 'transparent',
                                }))
                              }
                              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                                activeTemplate.schoolLogoStyle === 'transparent'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Rozetsiz doğrudan şeffaf baskı"
                            >
                              Şeffaf / Düz
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-700 font-medium">Logo Büyüklüğü:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={75}
                              max={140}
                              step={5}
                              value={activeTemplate.schoolLogoScale || 100}
                              onChange={(e) =>
                                updateActiveTemplate((p) => ({
                                  ...p,
                                  schoolLogoScale: parseInt(e.target.value, 10),
                                }))
                              }
                              className="w-24 accent-blue-600"
                            />
                            <span className="font-mono text-blue-700 font-bold w-10 text-right">
                              %{activeTemplate.schoolLogoScale || 100}
                            </span>
                          </div>
                        </div>

                        <p className="text-[10px] text-blue-800 leading-tight">
                          İpucu: Yüklediğiniz PNG okul logosu şeffaf zeminli ise koyu alanlarda net okunabilmesi için &apos;Beyaz Rozet&apos; modu tavsiye edilir.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Ön Yüz Kart Başlığı
                    </label>
                    <input
                      type="text"
                      value={activeTemplate.cardTitleText}
                      onChange={(e) =>
                        updateActiveTemplate((p) => ({
                          ...p,
                          cardTitleText: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Field Coordinates & Content Inspector for Active Side */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-blue-700">
                      {editingSide === 'front'
                        ? 'Ön Yüz Alan Ayarları'
                        : 'Arka Yüz Özel Alan Ayarları'}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingSide === 'front'
                        ? 'Ön Yüzdeki Alanları Seçin ve Düzenleyin'
                        : 'Arka Yüz Alanlarını (İmza, İletişim, Uyarı) Düzenleyin'}
                    </h3>
                  </div>
                </div>

                {/* Field Selector Buttons for Active Side */}
                {editingSide === 'front' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(Object.keys(activeTemplate.fields) as FrontFieldKey[]).map((key) => {
                      const f = activeTemplate.fields[key];
                      const isSel = selectedFrontField === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedFrontField(key)}
                          className={`px-2.5 py-2 text-xs font-semibold rounded-lg border text-left transition-colors truncate cursor-pointer ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(Object.keys(activeTemplate.backFields) as BackFieldKey[]).map((key) => {
                      const f = activeTemplate.backFields[key];
                      const isSel = selectedBackField === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedBackField(key)}
                          className={`px-2.5 py-2 text-xs font-semibold rounded-lg border text-left transition-colors truncate cursor-pointer ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selected Field Inspector */}
                {currentFieldConfig && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <span className="text-sm font-bold text-slate-900">
                        Seçili Alan: {currentFieldConfig.label}
                      </span>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentFieldConfig.visible}
                          onChange={(e) =>
                            updateCurrentSelectedField({ visible: e.target.checked })
                          }
                          className="rounded border-slate-300 text-blue-600"
                        />
                        Kartta Göster
                      </label>
                    </div>

                    {/* Editable Text Content for Back Side Fields (e.g. School Address, Phone, Return Notice, Signature Box Label) */}
                    {editingSide === 'back' && selectedBackField !== 'backBarcode' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Arka Yüz Metin İçeriği ({currentFieldConfig.label})
                        </label>
                        <textarea
                          rows={2}
                          value={currentFieldConfig.customText || ''}
                          onChange={(e) =>
                            updateCurrentSelectedField({ customText: e.target.value })
                          }
                          placeholder="Kartın arka yüzünde görünecek metin..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 resize-none"
                        />
                        {selectedBackField === 'studentInfoSummary' && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            İpucu: <code className="font-mono">{'{bloodType}'}</code> ve <code className="font-mono">{'{emergencyPhone}'}</code> ifadeleri her öğrencinin kendi kan grubu ve acil veli telefonuyla otomatik değiştirilir.
                          </p>
                        )}
                      </div>
                    )}

                     {/* X and Y Position Sliders */}
                    {activeSelectedFieldKey === 'schoolName' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-700 font-semibold">
                                1. Satır Yatay Konum (X)
                              </span>
                              <span className="font-mono font-semibold text-blue-700">
                                %{currentFieldConfig.x}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={96}
                              step={0.5}
                              value={currentFieldConfig.x}
                              onChange={(e) =>
                                updateCurrentSelectedField({ x: parseFloat(e.target.value) })
                              }
                              className="w-full accent-blue-600"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-700 font-semibold">
                                2. Satır Yatay Konum (X)
                              </span>
                              <span className="font-mono font-semibold text-blue-700">
                                %{currentFieldConfig.secondLineX ?? currentFieldConfig.x}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={96}
                              step={0.5}
                              value={currentFieldConfig.secondLineX ?? currentFieldConfig.x}
                              onChange={(e) =>
                                updateCurrentSelectedField({
                                  secondLineX: parseFloat(e.target.value),
                                })
                              }
                              className="w-full accent-blue-600"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-600 font-medium">
                                Dikey Konum (Üst Y)
                              </span>
                              <span className="font-mono font-semibold">
                                %{currentFieldConfig.y}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={90}
                              step={0.5}
                              value={currentFieldConfig.y}
                              onChange={(e) =>
                                updateCurrentSelectedField({ y: parseFloat(e.target.value) })
                              }
                              className="w-full accent-blue-600"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-600 font-medium">
                                Satır Arası Boşluk
                              </span>
                              <span className="font-mono font-semibold">
                                {currentFieldConfig.secondLineYOffset ?? 0}px
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-8}
                              max={20}
                              step={1}
                              value={currentFieldConfig.secondLineYOffset ?? 0}
                              onChange={(e) =>
                                updateCurrentSelectedField({
                                  secondLineYOffset: parseInt(e.target.value, 10),
                                })
                              }
                              className="w-full accent-blue-600"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium">Yatay Konum (X)</span>
                            <span className="font-mono font-semibold">%{currentFieldConfig.x}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={95}
                            step={0.5}
                            value={currentFieldConfig.x}
                            onChange={(e) =>
                              updateCurrentSelectedField({ x: parseFloat(e.target.value) })
                            }
                            className="w-full accent-blue-600"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium">Dikey Konum (Y)</span>
                            <span className="font-mono font-semibold">%{currentFieldConfig.y}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={95}
                            step={0.5}
                            value={currentFieldConfig.y}
                            onChange={(e) =>
                              updateCurrentSelectedField({ y: parseFloat(e.target.value) })
                            }
                            className="w-full accent-blue-600"
                          />
                        </div>
                      </div>
                    )}

                    {/* Width & Height Controls for Photo, Barcode, Signature Box, Principal Approval Box */}
                    {(activeSelectedFieldKey === 'photo' ||
                      activeSelectedFieldKey === 'barcode' ||
                      activeSelectedFieldKey === 'backBarcode' ||
                      activeSelectedFieldKey === 'studentSignatureBox' ||
                      activeSelectedFieldKey === 'principalApproval') && (
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium">Genişlik</span>
                            <span className="font-mono font-semibold">
                              %{currentFieldConfig.width || 28}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={80}
                            step={1}
                            value={currentFieldConfig.width || 28}
                            onChange={(e) =>
                              updateCurrentSelectedField({
                                width: parseFloat(e.target.value),
                              })
                            }
                            className="w-full accent-blue-600"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium">Yükseklik</span>
                            <span className="font-mono font-semibold">
                              %{currentFieldConfig.height || 24}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={80}
                            step={1}
                            value={currentFieldConfig.height || 24}
                            onChange={(e) =>
                              updateCurrentSelectedField({
                                height: parseFloat(e.target.value),
                              })
                            }
                            className="w-full accent-blue-600"
                          />
                        </div>
                      </div>
                    )}

                    {/* Typography Controls */}
                    {activeSelectedFieldKey !== 'photo' &&
                      activeSelectedFieldKey !== 'barcode' &&
                      activeSelectedFieldKey !== 'backBarcode' && (
                        <div className="space-y-3 pt-2 border-t border-slate-200">
                          {activeSelectedFieldKey === 'schoolName' ? (
                            <div className="space-y-3">
                              {/* Font Sizes for Line 1 and Line 2 */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-700 font-semibold">
                                      1. Satır Yazı Boyutu
                                    </span>
                                    <span className="font-mono font-semibold text-blue-700">
                                      {currentFieldConfig.fontSize}px
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={10}
                                    max={38}
                                    step={1}
                                    value={currentFieldConfig.fontSize}
                                    onChange={(e) =>
                                      updateCurrentSelectedField({
                                        fontSize: parseInt(e.target.value, 10),
                                      })
                                    }
                                    className="w-full accent-blue-600"
                                  />
                                </div>

                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-700 font-semibold">
                                      2. Satır Yazı Boyutu
                                    </span>
                                    <span className="font-mono font-semibold text-blue-700">
                                      {currentFieldConfig.secondLineFontSize ??
                                        currentFieldConfig.fontSize}
                                      px
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={10}
                                    max={44}
                                    step={1}
                                    value={
                                      currentFieldConfig.secondLineFontSize ??
                                      currentFieldConfig.fontSize
                                    }
                                    onChange={(e) =>
                                      updateCurrentSelectedField({
                                        secondLineFontSize: parseInt(e.target.value, 10),
                                      })
                                    }
                                    className="w-full accent-blue-600"
                                  />
                                </div>
                              </div>

                              {/* Independent Alignment for Line 1 and Line 2 */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs text-slate-700 font-semibold mb-1">
                                    1. Satır Hizalaması
                                  </label>
                                  <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden text-xs">
                                    {(['left', 'center', 'right'] as const).map((align) => {
                                      const defaultXForAlign =
                                        align === 'left'
                                          ? activeTemplate.id === 'modern-campus'
                                            ? 16.5
                                            : 18
                                          : align === 'center'
                                          ? 52
                                          : 92;
                                      return (
                                        <button
                                          key={align}
                                          type="button"
                                          onClick={() =>
                                            updateCurrentSelectedField({
                                              align,
                                              x: defaultXForAlign,
                                            })
                                          }
                                          className={`flex-1 py-1.5 font-semibold transition-colors cursor-pointer ${
                                            currentFieldConfig.align === align
                                              ? 'bg-blue-600 text-white'
                                              : 'text-slate-600 hover:bg-slate-50'
                                          }`}
                                        >
                                          {align === 'left'
                                            ? 'Sol'
                                            : align === 'center'
                                            ? 'Orta'
                                            : 'Sağ'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs text-slate-700 font-semibold mb-1">
                                    2. Satır Hizalaması
                                  </label>
                                  <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden text-xs">
                                    {(['left', 'center', 'right'] as const).map((align) => {
                                      const currentSecondAlign =
                                        currentFieldConfig.secondLineAlign ??
                                        currentFieldConfig.align;
                                      const defaultXForAlign =
                                        align === 'left'
                                          ? activeTemplate.id === 'modern-campus'
                                            ? 16.5
                                            : 18
                                          : align === 'center'
                                          ? 52
                                          : 92;
                                      return (
                                        <button
                                          key={align}
                                          type="button"
                                          onClick={() =>
                                            updateCurrentSelectedField({
                                              secondLineAlign: align,
                                              secondLineX: defaultXForAlign,
                                            })
                                          }
                                          className={`flex-1 py-1.5 font-semibold transition-colors cursor-pointer ${
                                            currentSecondAlign === align
                                              ? 'bg-blue-600 text-white'
                                              : 'text-slate-600 hover:bg-slate-50'
                                          }`}
                                        >
                                          {align === 'left'
                                            ? 'Sol'
                                            : align === 'center'
                                            ? 'Orta'
                                            : 'Sağ'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <label className="text-xs text-slate-600 font-medium">
                                  Okul İsmi Yazı Rengi
                                </label>
                                <input
                                  type="color"
                                  value={currentFieldConfig.color}
                                  onChange={(e) =>
                                    updateCurrentSelectedField({ color: e.target.value })
                                  }
                                  className="w-10 h-7 rounded border border-slate-200 cursor-pointer"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-slate-600 font-medium">Yazı Boyutu</span>
                                  <span className="font-mono font-semibold">
                                    {currentFieldConfig.fontSize}px
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={11}
                                  max={44}
                                  step={1}
                                  value={currentFieldConfig.fontSize}
                                  onChange={(e) =>
                                    updateCurrentSelectedField({
                                      fontSize: parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="w-full accent-blue-600"
                                />
                              </div>

                              <div>
                                <label className="block text-xs text-slate-600 font-medium mb-1">
                                  Yazı Rengi & Hizalama
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={currentFieldConfig.color}
                                    onChange={(e) =>
                                      updateCurrentSelectedField({ color: e.target.value })
                                    }
                                    className="w-8 h-7 rounded border border-slate-200 cursor-pointer"
                                  />
                                  <div className="flex flex-1 bg-white rounded border border-slate-200 overflow-hidden text-xs">
                                    {(['left', 'center', 'right'] as const).map((align) => (
                                      <button
                                        key={align}
                                        type="button"
                                        onClick={() => updateCurrentSelectedField({ align })}
                                        className={`flex-1 py-1 font-medium ${
                                          currentFieldConfig.align === align
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        {align === 'left'
                                          ? 'Sol'
                                          : align === 'center'
                                          ? 'Orta'
                                          : 'Sağ'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Upper Label Prefix Toggle */}
                          {activeSelectedFieldKey !== 'studentSignatureBox' &&
                            activeSelectedFieldKey !== 'principalApproval' && (
                              <div className="flex items-center justify-between gap-2 pt-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(currentFieldConfig.showPrefix)}
                                    onChange={(e) =>
                                      updateCurrentSelectedField({
                                        showPrefix: e.target.checked,
                                      })
                                    }
                                    className="rounded border-slate-300 text-blue-600"
                                  />
                                  <span>Üst Başlık Etiketi Göster</span>
                                </label>
                                {currentFieldConfig.showPrefix && (
                                  <input
                                    type="text"
                                    value={currentFieldConfig.prefixText || ''}
                                    onChange={(e) =>
                                      updateCurrentSelectedField({
                                        prefixText: e.target.value,
                                      })
                                    }
                                    placeholder="Etiket (Örn: Okul Adresi)"
                                    className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md w-44"
                                  />
                                )}
                              </div>
                            )}
                        </div>
                      )}

                    {/* Helpful indicator for Alanı / Bölümü field */}
                    {activeSelectedFieldKey === 'className' && (
                      <div className="mt-3 p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-lg flex items-start gap-2">
                        <span className="text-blue-600 text-sm leading-none mt-0.5">🛡️</span>
                        <p className="text-[11px] text-blue-900 leading-relaxed">
                          <strong>Akıllı Fotoğraf Koruması Aktif:</strong> Alan adı uzun olduğunda (örn. <em>Elektrik - Elektronik Teknolojisi</em>, <em>Bilişim Teknolojileri</em>) metin otomatik olarak 2 dengeli satıra bölünür ve fotoğraf çerçevesiyle asla çakışmaz.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const original = BUILT_IN_TEMPLATES.find(
                        (t) => t.id === activeTemplate.id
                      );
                      if (original) {
                        updateActiveTemplate((prev) => ({
                          ...original,
                          enableBackSide: prev.enableBackSide,
                        }));
                      }
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Şablon Ayarlarını Sıfırla
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('batch-preview')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    Toplu Önizlemeye Geç
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* WATERMARK SETTINGS PANEL (FİLİGRAN AYARLARI) */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-blue-700">
                      Güvenlik & Taslak Filigranı
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      Filigran Ayarları (Okul Logosu veya &apos;Örnek&apos; Yazısı)
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs font-bold text-blue-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeWatermark.enabled}
                      onChange={(e) => updateWatermark({ enabled: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span>Filigranı Aktif Et</span>
                  </label>
                </div>

                <div className="space-y-4">
                  {/* Watermark Type & Layer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Filigran Türü
                      </label>
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateWatermark({ enabled: true, type: 'logo' })}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            activeWatermark.type === 'logo'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Okul Logosu / Amblem
                        </button>
                        <button
                          type="button"
                          onClick={() => updateWatermark({ enabled: true, type: 'text' })}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            activeWatermark.type === 'text'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Özel Metin (Örnek vb.)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Filigran Konumu (Katman)
                      </label>
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateWatermark({ enabled: true, layer: 'background' })}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            activeWatermark.layer === 'background'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Fotoğraf ve öğrenci bilgilerinin altında, şablon zemininin üstünde yer alır"
                        >
                          Arka Plana (Zemin)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateWatermark({ enabled: true, layer: 'overlay' })}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                            activeWatermark.layer === 'overlay'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="Tüm kart tasarımının ve fotoğrafın üzerinde yarı şeffaf güvenlik katmanı olarak yer alır"
                        >
                          Kartın Üstüne (Üst Katman)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Text Input & Presets if type === 'text', or Logo Upload shortcut if type === 'logo' */}
                  {activeWatermark.type === 'text' ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Filigran Metni
                        </label>
                        <div className="flex items-center gap-1">
                          {['ÖRNEK', 'TASLAK', 'GEÇERSİZDİR', 'RESMİ BELGE'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                updateWatermark({ enabled: true, text: preset })
                              }
                              className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 hover:border-blue-500 text-slate-700 rounded transition-colors cursor-pointer"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={activeWatermark.text}
                        onChange={(e) =>
                          updateWatermark({ enabled: true, text: e.target.value })
                        }
                        placeholder="Örn: ÖRNEK KİMLİK KARTI veya Okul Adı"
                        className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800 block">
                          {activeTemplate.schoolLogoUrl
                            ? 'Yüklü Okul Logosu Filigran Olarak Kullanılıyor'
                            : 'Varsayılan Kurumsal Okul Amblemi Kullanılıyor'}
                        </span>
                        <span>
                          Kendi okul logonuzu yüklediğinizde otomatik olarak şeffaf filigrana dönüşür.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => schoolLogoInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        {activeTemplate.schoolLogoUrl ? 'Logoyu Değiştir' : '+ Logo Yükle'}
                      </button>
                    </div>
                  )}

                  {/* Opacity, Scale, Rotation Sliders */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">Şeffaflık (Opaklık)</span>
                        <span className="font-mono font-semibold text-blue-700">
                          %{Math.round((activeWatermark.opacity ?? 0.08) * 100)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={3}
                        max={45}
                        step={1}
                        value={Math.round((activeWatermark.opacity ?? 0.08) * 100)}
                        onChange={(e) =>
                          updateWatermark({
                            enabled: true,
                            opacity: parseInt(e.target.value, 10) / 100,
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">Filigran Boyutu</span>
                        <span className="font-mono font-semibold text-blue-700">
                          %{activeWatermark.scale}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={110}
                        step={2}
                        value={activeWatermark.scale}
                        onChange={(e) =>
                          updateWatermark({
                            enabled: true,
                            scale: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium">Döndürme Açısı</span>
                        <span className="font-mono font-semibold text-blue-700">
                          {activeWatermark.rotation}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-60}
                        max={60}
                        step={5}
                        value={activeWatermark.rotation}
                        onChange={(e) =>
                          updateWatermark({
                            enabled: true,
                            rotation: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>

                  {/* Pattern & Back Side Checkboxes */}
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeWatermark.repeatedPattern}
                        onChange={(e) =>
                          updateWatermark({
                            enabled: true,
                            repeatedPattern: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>Çoklu Çapraz Desen (Tüm Karta Döşe)</span>
                    </label>

                    <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeWatermark.applyToBackSide}
                        onChange={(e) =>
                          updateWatermark({
                            enabled: true,
                            applyToBackSide: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>Arka Yüze de Filigran Uygula</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ZİYARETÇİ VE GÖREVLİ KARTLARI ÜRETİCİ */}
        {activeTab === 'visitor-staff' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-blue-700">
                  Hızlı Özel Kart Üreticisi
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Ziyaretçi ve Görevli Kimlik Kartları
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mevcut okul şablonunuzun (kurumsal renkler, logo, 2 satırlı okul adı ve filigran) aynısını kullanarak istediğiniz sayıda Ziyaretçi ve Görevli Kartı üretin.
                </p>
              </div>

              {/* Mode Toggle: Ziyaretçi vs Görevli */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setVisitorMode('visitor')}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    visitorMode === 'visitor'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Ziyaretçi Kartları ({visitorCardCount} Adet)
                </button>
                <button
                  type="button"
                  onClick={() => setVisitorMode('staff')}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    visitorMode === 'staff'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Görevli Kartları ({staffCardCount} Adet)
                </button>
              </div>
            </div>

            {/* Split Grid: Left Form Controls & Quick Generators | Right Live Canvas Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 6 Columns: Generator Settings & Customization */}
              <div className="lg:col-span-6 space-y-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {visitorMode === 'visitor'
                          ? 'Ziyaretçi Kartı Yapılandırması'
                          : 'Görevli Kartı Yapılandırması'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {visitorMode === 'visitor'
                          ? 'Nizamiye ve güvenlik girişlerinde kullanılacak misafir kartları'
                          : 'Sınav, etkinlik, nöbetçi öğretmen ve kurum personeli kartları'}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-slate-100 text-slate-700">
                      Toplam: {visitorMode === 'visitor' ? visitorCardCount : staffCardCount} Kart
                    </span>
                  </div>

                  {/* Card Quantity Control (Sayısını kendisi belirleyebilir!) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Üretilecek Kart Sayısı (Adet):
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={visitorMode === 'visitor' ? visitorCardCount : staffCardCount}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 1));
                          if (visitorMode === 'visitor') setVisitorCardCount(val);
                          else setStaffCardCount(val);
                        }}
                        className="w-28 px-3 py-2 text-sm font-bold text-center border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                      />
                      {/* Quick Count Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[5, 10, 15, 20, 30, 50].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              if (visitorMode === 'visitor') setVisitorCardCount(preset);
                              else setStaffCardCount(preset);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                              (visitorMode === 'visitor' ? visitorCardCount : staffCardCount) === preset
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {preset} Adet
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Prefix & Numbering */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Numara Ön-Kodu (Prefix):
                      </label>
                      <input
                        type="text"
                        value={visitorMode === 'visitor' ? visitorCardPrefix : staffCardPrefix}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          if (visitorMode === 'visitor') setVisitorCardPrefix(val);
                          else setStaffCardPrefix(val);
                        }}
                        placeholder={visitorMode === 'visitor' ? 'ZYR' : 'GRV'}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Örn: {visitorMode === 'visitor' ? visitorCardPrefix : staffCardPrefix}-001, {visitorMode === 'visitor' ? visitorCardPrefix : staffCardPrefix}-002
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kart Başlığı:
                      </label>
                      <input
                        type="text"
                        value={visitorMode === 'visitor' ? visitorCardTitle : staffCardTitle}
                        onChange={(e) => {
                          if (visitorMode === 'visitor') setVisitorCardTitle(e.target.value);
                          else setStaffCardTitle(e.target.value);
                        }}
                        placeholder={visitorMode === 'visitor' ? 'ZİYARETÇİ KARTI' : 'GÖREVLİ KARTI'}
                        className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  {/* Field / Department (Alanı) & Subtitle */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Alanı / Görevi (Kartın &apos;Alanı&apos; Bölümünde Yazar):
                    </label>
                    <input
                      type="text"
                      value={visitorMode === 'visitor' ? visitorCardSubtitle : staffCardSubtitle}
                      onChange={(e) => {
                        if (visitorMode === 'visitor') setVisitorCardSubtitle(e.target.value);
                        else setStaffCardSubtitle(e.target.value);
                      }}
                      placeholder="Örn: Sınav Salon Başkanı / Güvenlik Kontrolü"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                    {/* Quick Suggestions */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {(visitorMode === 'visitor'
                        ? [
                            'Günübirlik Giriş / Güvenlik Kontrolü',
                            'Misafir Girişi',
                            'Veli Görüşme Kartı',
                            'Yetkili Ziyaretçi',
                          ]
                        : [
                            'Sınav & Etkinlik Görevlisi',
                            'Sınav Salon Başkanı',
                            'Gözetmen / Nöbetçi Öğretmen',
                            'Kurum Personeli',
                          ]
                      ).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (visitorMode === 'visitor') setVisitorCardSubtitle(preset);
                            else setStaffCardSubtitle(preset);
                          }}
                          className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* School Name & Template info notice */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        Kullanılan Okul Şablonu:
                      </span>
                      <span className="font-medium text-blue-700">
                        {activeTemplate.name} ({activeTemplate.orientation === 'landscape' ? 'Yatay' : 'Dikey'})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Okul İsmi:</span>
                      <span className="text-slate-800 font-medium truncate max-w-[240px]">
                        {globalSchoolLine1} {globalSchoolLine2}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Arka Yüz (İki Yönlü):</span>
                      <span className="font-medium">
                        {activeTemplate.enableBackSide ? 'Aktif (Ön + Arka Birlikte Basılır)' : 'Sadece Ön Yüz'}
                      </span>
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handleExportVisitorOrStaffPdf(visitorMode)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                        visitorMode === 'visitor'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      {visitorMode === 'visitor'
                        ? `Ziyaretçi Kartlarını PDF İndir (${visitorCardCount} Adet)`
                        : `Görevli Kartlarını PDF İndir (${staffCardCount} Adet)`}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAppendVisitorCardsToStudents(visitorMode)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      title="Bu kartları ana öğrenci listesine aktararak tüm kartlarla birlikte tek A4 çıktısında basabilirsiniz"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ana Listeye Ekle ({visitorMode === 'visitor' ? visitorCardCount : staffCardCount} Kart)
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 6 Columns: Live Interactive Canvas Preview */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-blue-700">
                        Canlı Önizleme
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {visitorMode === 'visitor' ? 'Örnek Ziyaretçi Kartı' : 'Örnek Görevli Kartı'} (1. Kart)
                      </h3>
                    </div>

                    {/* Front / Back Toggle */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setVisitorSide('front')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          visitorSide === 'front'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Ön Yüz
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisitorSide('back')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          visitorSide === 'back'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Arka Yüz
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center bg-slate-100 border border-slate-200 rounded-xl p-5">
                    {visitorMode === 'visitor' ? (
                      <CardCanvasPreview
                        student={currentVisitorList[0] || previewStudent}
                        template={activeTemplate}
                        side={visitorSide}
                        className="w-full max-w-md shadow-sm"
                      />
                    ) : (
                      <CardCanvasPreview
                        student={currentStaffList[0] || previewStudent}
                        template={activeTemplate}
                        side={visitorSide}
                        className="w-full max-w-md shadow-sm"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>
                      {visitorMode === 'visitor'
                        ? `Format: ${visitorCardPrefix}-001 .. ${visitorCardPrefix}-${String(visitorCardCount).padStart(3, '0')}`
                        : `Format: ${staffCardPrefix}-001 .. ${staffCardPrefix}-${String(staffCardCount).padStart(3, '0')}`}
                    </span>
                    <span className="font-semibold text-slate-700">
                      Öğrenci Şablonu ile %100 Uyumlu
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated Cards Preview Gallery Grid */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Oluşturulacak {visitorMode === 'visitor' ? 'Ziyaretçi' : 'Görevli'} Kartları Listesi ({visitorMode === 'visitor' ? currentVisitorList.length : currentStaffList.length} Kart)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tüm kartlar ardışık numaralandırılmış olup çıktıda birebir bu sırayla basılacaktır.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => handleExportVisitorOrStaffPdf(visitorMode)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Bu Listeyi PDF İndir
                </button>
              </div>

              <div
                className={`grid gap-4 ${
                  activeTemplate.orientation === 'landscape'
                    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'
                }`}
              >
                {(visitorMode === 'visitor' ? currentVisitorList : currentStaffList).map(
                  (cardItem, idx) => (
                    <div
                      key={cardItem.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-700">
                        <span>#{idx + 1}</span>
                        <span className="text-blue-700 font-bold">{cardItem.studentNumber}</span>
                      </div>
                      <CardCanvasPreview
                        student={cardItem}
                        template={activeTemplate}
                        side="front"
                        className="w-full"
                      />
                      <div className="text-[10px] text-slate-500 text-center font-medium truncate">
                        {cardItem.fieldOfStudy}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TOPLU ÖNİZLEME & A4 BASKI MERKEZİ */}
        {activeTab === 'batch-preview' && (
          <div className="space-y-6">
            {/* Batch Export Control Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-blue-700">
                  Baskıya Hazır Toplu Kimlik Listesi
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  {students.length} Öğrenci Kimlik Kartı (
                  {activeTemplate.enableBackSide
                    ? 'Çift Taraflı: Ön + Arka Yüz'
                    : 'Tek Taraflı: Sadece Ön Yüz'}
                  ) Çıktıya Hazır
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeTemplate.enableBackSide
                    ? 'A4 çoklu baskıda her ön yüz sayfasının hemen arkasına, arkalı-önlü (dubleks) yazıcılarla tam hizalı arka yüz sayfası otomatik eklenir.'
                    : 'İsterseniz sağdaki kutucuktan arka yüz tasarımını da aktif ederek çift taraflı PDF alabilirsiniz.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Optional Watermark Quick Toggle inside Batch Preview */}
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeWatermark.enabled}
                    onChange={(e) => updateWatermark({ enabled: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>
                    Filigran ({activeWatermark.type === 'logo' ? 'Okul Logosu' : activeWatermark.text || 'ÖRNEK'})
                  </span>
                </label>

                {/* Optional Back Side Toggle right inside Batch Preview */}
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeTemplate.enableBackSide}
                    onChange={(e) => handleToggleBackSide(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>Arka Yüzü Dahil Et (Çift Taraflı)</span>
                </label>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() =>
                      setPdfSettings((s) => ({ ...s, layoutMode: 'a4-grid' }))
                    }
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      pdfSettings.layoutMode === 'a4-grid'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    A4 Çoklu Sayfa (
                    {Math.ceil(
                      students.length /
                        (activeTemplate.orientation === 'landscape' ? 10 : 9)
                    ) * (activeTemplate.enableBackSide ? 2 : 1)}{' '}
                    Sayfa)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPdfSettings((s) => ({ ...s, layoutMode: 'single-card' }))
                    }
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      pdfSettings.layoutMode === 'single-card'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Tekli Kart (PVC Yazıcı)
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isExportingPdf || students.length === 0}
                  onClick={handleExportBatchPdf}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {isExportingPdf && exportProgress
                    ? `PDF Hazırlanıyor (${exportProgress.current}/${exportProgress.total})`
                    : `Tümünü PDF İndir (${students.length} Öğrenci)`}
                </button>
              </div>
            </div>

            {/* Grid of All Generated Student ID Cards (Shows both Front and Back side-by-side if Back Side is enabled) */}
            <div
              className={`grid gap-6 ${
                activeTemplate.enableBackSide
                  ? 'grid-cols-1 xl:grid-cols-2'
                  : activeTemplate.orientation === 'landscape'
                  ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
              }`}
            >
              {students.map((student, idx) => (
                <div
                  key={student.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-800">
                      #{idx + 1} · No: {student.studentNumber} · {student.fullName}
                    </span>
                    <span>Sınıf: {student.className}</span>
                  </div>

                  {activeTemplate.enableBackSide ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="block text-[11px] font-semibold text-slate-500">
                          Ön Yüz
                        </span>
                        <CardCanvasPreview
                          student={student}
                          template={activeTemplate}
                          side="front"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[11px] font-semibold text-blue-700">
                          Arka Yüz
                        </span>
                        <CardCanvasPreview
                          student={student}
                          template={activeTemplate}
                          side="back"
                          className="w-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <CardCanvasPreview
                      student={student}
                      template={activeTemplate}
                      side="front"
                      className="w-full"
                    />
                  )}

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500 truncate">
                      {student.bloodType ? `Kan Grubu: ${student.bloodType}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSinglePhotoTargetStudentId(student.id);
                        singleRowPhotoInputRef.current?.click();
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                    >
                      Fotoğraf Değiştir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
