import React, { useEffect, useRef } from 'react';
import {
  BackFieldKey,
  CardTemplate,
  FieldKey,
  FrontFieldKey,
  StudentRecord,
} from '../types';
import {
  CARD_HEIGHT_LANDSCAPE,
  CARD_WIDTH_LANDSCAPE,
  renderStudentCardToCanvas,
} from '../utils/cardRenderer';

interface CardCanvasPreviewProps {
  student: StudentRecord;
  template: CardTemplate;
  side?: 'front' | 'back';
  selectedField?: FieldKey | null;
  interactive?: boolean;
  onSelectField?: (field: FieldKey) => void;
  onMoveField?: (field: FieldKey, newX: number, newY: number) => void;
  className?: string;
}

export const CardCanvasPreview: React.FC<CardCanvasPreviewProps> = ({
  student,
  template,
  side = 'front',
  selectedField = null,
  interactive = false,
  onSelectField,
  onMoveField,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingFieldRef = useRef<FieldKey | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const isLandscape = template.orientation === 'landscape';
  const logicalW = isLandscape ? CARD_WIDTH_LANDSCAPE : CARD_HEIGHT_LANDSCAPE;
  const logicalH = isLandscape ? CARD_HEIGHT_LANDSCAPE : CARD_WIDTH_LANDSCAPE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderStudentCardToCanvas(canvas, student, template, {
      side,
      selectedField,
      showInteractiveGuides: interactive,
    });
  }, [student, template, side, selectedField, interactive]);

  const getPercentageCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { xPct: 0, yPct: 0 };
    const rect = canvas.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    return { xPct, yPct };
  };

  const findClickedField = (xPct: number, yPct: number): FieldKey | null => {
    if (side === 'back') {
      const backKeys: BackFieldKey[] = [
        'studentSignatureBox',
        'principalApproval',
        'backBarcode',
        'backTitle',
        'returnNotice',
        'schoolAddress',
        'schoolPhone',
        'schoolWebsite',
        'studentInfoSummary',
      ];

      for (const key of backKeys) {
        const f = template.backFields?.[key];
        if (!f || !f.visible) continue;

        if (key === 'studentSignatureBox' || key === 'principalApproval' || key === 'backBarcode') {
          const w = f.width || 30;
          const h = f.height || 20;
          if (xPct >= f.x - 1 && xPct <= f.x + w + 1 && yPct >= f.y - 1 && yPct <= f.y + h + 1) {
            return key;
          }
        } else {
          const approxW = 45;
          const approxH = 10;
          let left = f.x;
          if (f.align === 'center') left = f.x - approxW / 2;
          else if (f.align === 'right') left = f.x - approxW;

          if (xPct >= left - 2 && xPct <= left + approxW + 2 && yPct >= f.y - 2 && yPct <= f.y + approxH + 2) {
            return key;
          }
        }
      }
      return null;
    }

    const frontKeys: FrontFieldKey[] = [
      'photo',
      'barcode',
      'fullName',
      'studentNumber',
      'className',
      'academicYear',
      'schoolName',
      'cardTitle',
    ];

    for (const key of frontKeys) {
      const f = template.fields[key];
      if (!f || !f.visible) continue;

      if (key === 'photo' || key === 'barcode') {
        const w = f.width || 25;
        const h = f.height || 40;
        if (xPct >= f.x - 1 && xPct <= f.x + w + 1 && yPct >= f.y - 1 && yPct <= f.y + h + 1) {
          return key;
        }
      } else {
        const approxW = 32;
        const approxH = 11;
        let left = f.x;
        if (f.align === 'center') left = f.x - approxW / 2;
        else if (f.align === 'right') left = f.x - approxW;

        if (xPct >= left - 2 && xPct <= left + approxW + 2 && yPct >= f.y - 2 && yPct <= f.y + approxH + 2) {
          return key;
        }
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const { xPct, yPct } = getPercentageCoords(e);
    const hit = findClickedField(xPct, yPct);
    if (hit) {
      onSelectField?.(hit);
      draggingFieldRef.current = hit;
      const field =
        side === 'back'
          ? template.backFields[hit as BackFieldKey]
          : template.fields[hit as FrontFieldKey];
      if (field) {
        dragOffsetRef.current = {
          dx: xPct - field.x,
          dy: yPct - field.y,
        };
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !draggingFieldRef.current || !onMoveField) return;
    const { xPct, yPct } = getPercentageCoords(e);
    const nextX = Math.max(1, Math.min(96, Math.round((xPct - dragOffsetRef.current.dx) * 2) / 2));
    const nextY = Math.max(1, Math.min(95, Math.round((yPct - dragOffsetRef.current.dy) * 2) / 2));
    onMoveField(draggingFieldRef.current, nextX, nextY);
  };

  const handleMouseUp = () => {
    draggingFieldRef.current = null;
  };

  return (
    <div
      className={`relative select-none overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
      style={{
        aspectRatio: isLandscape ? '1012 / 638' : '638 / 1012',
      }}
    >
      <canvas
        ref={canvasRef}
        width={logicalW}
        height={logicalH}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`h-full w-full block ${interactive ? 'cursor-move' : ''}`}
      />
    </div>
  );
};
