/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceStatus, 
  AttendanceRecord,
  UserRole
} from '../types/attendance';
import { 
  getRecordKey, 
  isStudentExcluded, 
  sortStudents
} from '../utils/attendanceHelpers';
import { 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  ArrowUpDown, 
  Search, 
  CheckCheck
} from 'lucide-react';

interface MonthlyGridViewProps {
  students: Student[];
  session: SessionType;
  year: number;
  month: number;
  activeDays: DayConfig[];
  records: Record<string, AttendanceRecord>;
  onUpdateRecord: (
    studentId: string, 
    dateStr: string, 
    status: AttendanceStatus, 
    reason?: string,
    checkInTime?: string
  ) => void;
  onBatchUpdateDay: (
    dateStr: string, 
    status: AttendanceStatus, 
    gradeFilter?: number
  ) => void;
  onFillDayAbsent: (dateStr: string, gradeFilter?: number) => void;
  onUpdateStudents: (newStudents: Student[]) => void;
  onSessionChange: (newSession: SessionType) => void;
  onMonthChange: (newMonth: number) => void;
  userRole: UserRole;
}

export const MonthlyGridView: React.FC<MonthlyGridViewProps> = ({
  students,
  session,
  year,
  month,
  activeDays,
  records,
  onUpdateRecord,
  onBatchUpdateDay,
  onFillDayAbsent,
  onUpdateStudents,
  onSessionChange,
  onMonthChange,
  userRole
}) => {
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    studentName: string;
    dateStr: string;
    dayNum: number;
    currentStatus: AttendanceStatus;
    currentReason?: string;
  } | null>(null);

  const [inputReason, setInputReason] = useState('');
  const isReadOnly = userRole === 'student';

  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      if (selectedGrade !== 'all' && st.grade !== selectedGrade) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchName = st.name.toLowerCase().includes(q);
        const matchNum = `${st.grade}${st.classNum}${String(st.number).padStart(2, '0')}`.includes(q);
        return matchName || matchNum;
      }
      return true;
    });
  }, [students, selectedGrade, searchQuery]);

  const handleCellClick = (student: Student, dateStr: string, dayNum: number) => {
    if (isReadOnly) return;
    const isExcluded = isStudentExcluded(student, session, dateStr);
    if (isExcluded) return;

    const key = getRecordKey(student.id, session, dateStr);
    const currentRec = records[key];
    const currentStatus = currentRec?.status || 'NONE';
    const currentReason = currentRec?.reason || '';

    setEditingCell({
      studentId: student.id,
      studentName: student.name,
      dateStr,
      dayNum,
      currentStatus,
      currentReason
    });
    setInputReason(currentReason);
  };

  const handleSaveStatus = (status: AttendanceStatus) => {
    if (!editingCell) return;
    onUpdateRecord(
      editingCell.studentId,
      editingCell.dateStr,
      status,
      inputReason.trim() === '' ? undefined : inputReason.trim()
    );
    setEditingCell(null);
  };

  const gradeCounts = useMemo(() => {
    return {
      all: students.length,
      3: students.filter(s => s.grade === 3).length,
      2: students.filter(s => s.grade === 2).length,
      1: students.filter(s => s.grade === 1).length,
    };
  }, [students]);

  // 배지 스타일 자체 렌더링 헬퍼
  const getBadgeDetails = (status: AttendanceStatus, isExcluded: boolean) => {
    if (isExcluded) {
      return {
        label: '학원',
        icon: '학원',
        bgClass: 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500',
        textClass: 'text-slate-400 dark:text-slate-500 font-bold'
      };
    }
    switch (status) {
      case 'PRESENT':
        return {
          label: '출석',
          icon: 'O',
          bgClass: 'bg-emerald-50/70 dark:bg-emerald-950/40',
          textClass: 'text-emerald-600 dark:text-emerald-400 font-black'
        };
      case 'EXCUSED':
        return {
          label: '인정',
          icon: '인',
          bgClass: 'bg-blue-50/70 dark:bg-blue-950/40',
          textClass: 'text-blue-600 dark:text-blue-400 font-black'
        };
      case 'ABSENT':
        return {
          label: '결석',
          icon: 'X',
          bgClass: 'bg-rose-50/70 dark:bg-rose-950/40',
          textClass: 'text-rose-600 dark:text-rose-400 font-black'
        };
      default:
        return {
          label: '미체크',
          icon: '-',
          bgClass: 'bg-transparent',
          textClass: 'text-slate-200 dark:text-slate-800'
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setSelectedGrade('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedGrade === 'all'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              전체 ({gradeCounts.all})
            </button>
            <button
              onClick={() => setSelectedGrade(3)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedGrade === 3
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              3학년 ({gradeCounts[3]})
            </button>
            <button
              onClick={() => setSelectedGrade(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedGrade === 2
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              2학년 ({gradeCounts[2]})
            </button>
            <button
              onClick={() => setSelectedGrade(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedGrade === 1
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              1학년 ({gradeCounts[1]})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="학생 이름 / 학번 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-44"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 출석(O)
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> 인정(인)
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> 결석(X)
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span> 학원
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
          <table className="w-full text-center border-collapse text-xs select-none">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[32px]">
                  #
                </th>
                <th className="sticky left-[32px] z-30 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[32px]">
                  학년
                </th>
                <th className="sticky left-[64px] z-30 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[32px]">
                  반
                </th>
                <th className="sticky left-[96px] z-30 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[32px]">
                  번호
                </th>
                <th className="sticky left-[128px] z-30 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 min-w-[70px]">
                  이름
                </th>

                {/* Day Columns */}
                {activeDays.map((day) => (
                  <th
                    key={day.dateStr}
                    className="px-2 py-2 font-bold border-r border-slate-200 dark:border-slate-800 min-w-[42px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[13px] font-black text-slate-800 dark:text-slate-200">
                        {day.dayNum}
                      </span>
                      <span className={`text-[10px] font-medium ${
                        day.dayOfWeek === '토' ? 'text-blue-500' :
                        day.dayOfWeek === '일' ? 'text-rose-500' : 'text-slate-400'
                      }`}>
                        {day.dayOfWeek}
                      </span>
                    </div>
                  </th>
                ))}

                {/* Stats Header */}
                <th className="px-2 py-2.5 font-bold text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-800 min-w-[36px]">
                  출석
                </th>
                <th className="px-2 py-2.5 font-bold text-rose-600 dark:text-rose-400 border-r border-slate-200 dark:border-slate-800 min-w-[36px]">
                  결석
                </th>
                <th className="px-2 py-2.5 font-bold text-indigo-600 dark:text-indigo-400 min-w-[46px]">
                  출석률
                </th>
              </tr>

              {/* Summary Row for Daily Totals */}
              <tr className="bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 font-bold">
                <td colSpan={5} className="sticky left-0 z-30 bg-indigo-50/90 dark:bg-indigo-950/90 px-3 py-1.5 text-left text-indigo-700 dark:text-indigo-300 border-r border-indigo-100 dark:border-indigo-900/50">
                  {selectedGrade === 'all' ? '전체 현원(출석)' : `${selectedGrade}학년 현원(출석)`}
                </td>
                {activeDays.map(day => {
                  const presentCount = students
                    .filter(s => (selectedGrade === 'all' || s.grade === selectedGrade) && s.active && !isStudentExcluded(s, session, day.dateStr))
                    .filter(s => {
                      const k = getRecordKey(s.id, session, day.dateStr);
                      return records[k]?.status === 'PRESENT';
                    }).length;

                  return (
                    <td key={`sum_${day.dateStr}`} className="px-1 py-1.5 text-indigo-600 dark:text-indigo-400 border-r border-indigo-100 dark:border-indigo-900/50 font-black">
                      {presentCount}
                    </td>
                  );
                })}
                <td colSpan={3} className="bg-indigo-50/90 dark:bg-indigo-950/90"></td>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredStudents.map((st, idx) => {
                const presentCount = activeDays.filter(d => !isStudentExcluded(st, session, d.dateStr) && records[getRecordKey(st.id, session, d.dateStr)]?.status === 'PRESENT').length;
                const absentCount = activeDays.filter(d => !isStudentExcluded(st, session, d.dateStr) && records[getRecordKey(st.id, session, d.dateStr)]?.status === 'ABSENT').length;
                const totalApp = activeDays.filter(d => !isStudentExcluded(st, session, d.dateStr)).length;
                const rate = totalApp > 0 ? Math.round((presentCount / totalApp) * 100) : 0;
                const stats = { presentCount, absentCount, totalApplicableDays: totalApp, rate };

                return (
                  <tr 
                    key={st.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-1 py-2 text-slate-400 border-r border-slate-100 dark:border-slate-800">
                      {idx + 1}
                    </td>
                    <td className="sticky left-[32px] z-10 bg-white dark:bg-slate-900 px-1 py-2 text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 font-bold">
                      {st.grade}
                    </td>
                    <td className="sticky left-[64px] z-10 bg-white dark:bg-slate-900 px-1 py-2 text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {st.classNum}
                    </td>
                    <td className="sticky left-[96px] z-10 bg-white dark:bg-slate-900 px-1 py-2 text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {st.number}
                    </td>
                    <td className="sticky left-[128px] z-10 bg-white dark:bg-slate-900 px-2 py-2 text-slate-900 dark:text-slate-100 font-bold border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      {st.name}
                    </td>

                    {/* Day Cells */}
                    {activeDays.map(day => {
                      const isExcluded = isStudentExcluded(st, session, day.dateStr);
                      const key = getRecordKey(st.id, session, day.dateStr);
                      const rec = records[key];
                      const status = rec?.status || 'NONE';
                      const badge = getBadgeDetails(status, isExcluded);

                      let tooltipText = `${st.name} (${day.dayNum}일) - ${badge.label}`;
                      if (rec?.checkInTime) {
                        tooltipText += ` [체크 시간: ${rec.checkInTime}]`;
                      }
                      if (rec?.reason && rec.reason.trim() !== '') {
                        tooltipText += ` [사유: ${rec.reason}]`;
                      }

                      return (
                        <td
                          key={day.dateStr}
                          onClick={() => handleCellClick(st, day.dateStr, day.dayNum)}
                          title={tooltipText}
                          className={`px-1 py-2 border-r border-slate-100 dark:border-slate-800 transition-all ${
                            isExcluded
                              ? 'bg-slate-50/60 dark:bg-slate-800/20 text-slate-300 dark:text-slate-600'
                              : 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
                          } ${badge.bgClass}`}
                        >
                          <div className="relative inline-flex items-center justify-center min-w-[24px]">
                            <span className={`font-black ${badge.textClass}`}>
                              {badge.icon}
                            </span>
                            {rec?.reason && rec.reason.trim() !== '' && (
                              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Monthly Student Stats */}
                    <td className="px-1 py-2 font-bold text-emerald-600 dark:text-emerald-400 border-r border-slate-100 dark:border-slate-800">
                      {stats.presentCount}
                    </td>
                    <td className="px-1 py-2 font-bold text-rose-600 dark:text-rose-400 border-r border-slate-100 dark:border-slate-800">
                      {stats.absentCount}
                    </td>
                    <td className="px-1 py-2 font-bold text-indigo-600 dark:text-indigo-400">
                      {stats.totalApplicableDays > 0 ? `${stats.rate}%` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Status Modal */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-full">
                {editingCell.dayNum}일 ({session === 'morning' ? '오전자습' : '야간자습'})
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                {editingCell.studentName} 출석 상태 변경
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleSaveStatus('PRESENT')}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border font-bold text-xs transition-all ${
                  editingCell.currentStatus === 'PRESENT'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>출석 (O)</span>
              </button>

              <button
                onClick={() => handleSaveStatus('EXCUSED')}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border font-bold text-xs transition-all ${
                  editingCell.currentStatus === 'EXCUSED'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <AlertCircle className="w-5 h-5 text-blue-500" />
                <span>인정 (인)</span>
              </button>

              <button
                onClick={() => handleSaveStatus('ABSENT')}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border font-bold text-xs transition-all ${
                  editingCell.currentStatus === 'ABSENT'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:bg-rose-50/50'
                }`}
              >
                <XCircle className="w-5 h-5 text-rose-500" />
                <span>결석 (X)</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                사유 및 비고 입력
              </label>
              <input
                type="text"
                placeholder="예: 병원 진료, 수행평가 등"
                value={inputReason}
                onChange={(e) => setInputReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleSaveStatus('NONE')}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold"
              >
                기록 초기화
              </button>
              <button
                onClick={() => setEditingCell(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
