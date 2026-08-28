/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  getStatusBadgeInfo,
  calculateDailySessionStats 
} from '../utils/attendanceHelpers';
import { 
  playKioskSuccessSound, 
  speakKioskMessage 
} from '../utils/kioskSound';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Users, 
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  LogOut,
  Calendar,
  MessageSquare,
  Check,
  X
} from 'lucide-react';

interface KioskAttendanceViewProps {
  students: Student[];
  session: SessionType;
  setSession: (session: SessionType) => void;
  activeDays: DayConfig[];
  selectedDateStr: string;
  setSelectedDateStr: (dateStr: string) => void;
  records: Record<string, AttendanceRecord>;
  onUpdateRecord: (
    studentId: string, 
    dateStr: string, 
    status: AttendanceStatus, 
    reason?: string,
    checkInTime?: string
  ) => void;
  userRole: UserRole;
  onExitKiosk: () => void;
}

const PRESET_REASONS = [
  '병원 진료',
  '조퇴 (학원)',
  '수행평가',
  '가족 행사',
  '컨디션 난조',
  '학교 행사'
];

export const KioskAttendanceView: React.FC<KioskAttendanceViewProps> = ({
  students,
  session,
  setSession,
  activeDays,
  selectedDateStr,
  setSelectedDateStr,
  records,
  onUpdateRecord,
  userRole,
  onExitKiosk
}) => {
  const [selectedGrade, setSelectedGrade] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // 현재 시각 실시간 표시
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 모달 상태
  const [activeModalStudent, setActiveModalStudent] = useState<Student | null>(null);
  const [modalReason, setModalReason] = useState('');
  const [isTypingReason, setIsTypingReason] = useState(false); // 사유 입력 중 여부 (타이머 일시정지)
  const [autoCloseTimer, setAutoCloseTimer] = useState<number>(5);
  const [lastCheckinToast, setLastCheckinToast] = useState<{
    name: string;
    status: AttendanceStatus;
    time: string;
  } | null>(null);

  // 모달 자동 닫힘 카운트다운 (사유 입력 중일 때는 멈춤)
  useEffect(() => {
    if (!activeModalStudent) return;
    if (isTypingReason) return; // 사용자가 입력 중이면 타이머 정지

    const interval = setInterval(() => {
      setAutoCloseTimer(prev => {
        if (prev <= 1) {
          handleCloseModal();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeModalStudent, isTypingReason]);

  const handleOpenStudentModal = (student: Student) => {
    const isExcluded = isStudentExcluded(student, session, selectedDateStr);
    if (isExcluded) return;

    const key = getRecordKey(student.id, session, selectedDateStr);
    const existing = records[key];
    
    setActiveModalStudent(student);
    setModalReason(existing?.reason || '');
    setIsTypingReason(false);
    setAutoCloseTimer(5);
  };

  const handleCloseModal = () => {
    setActiveModalStudent(null);
    setModalReason('');
    setIsTypingReason(false);
  };

  const handleCheckin = (status: AttendanceStatus) => {
    if (!activeModalStudent) return;

    const now = new Date();
    const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const cleanReason = modalReason.trim() === '' ? undefined : modalReason.trim();

    onUpdateRecord(
      activeModalStudent.id,
      selectedDateStr,
      status,
      cleanReason,
      timeFormatted
    );

    if (soundEnabled) {
      playKioskSuccessSound();
      const statusKorean = status === 'PRESENT' ? '출석 완료' : status === 'EXCUSED' ? '인정 처리' : '결석 처리';
      speakKioskMessage(`${activeModalStudent.name} 학생, ${statusKorean} 되었습니다.`);
    }

    setLastCheckinToast({
      name: activeModalStudent.name,
      status,
      time: timeFormatted
    });

    handleCloseModal();

    setTimeout(() => {
      setLastCheckinToast(null);
    }, 4000);
  };

  const handleAddPresetReason = (reason: string) => {
    setModalReason(prev => {
      if (!prev || prev.trim() === '') return reason;
      if (prev.includes(reason)) return prev;
      return `${prev}, ${reason}`;
    });
    setIsTypingReason(true); // 칩 클릭 시에도 입력 상태로 유지하여 시간 여유 제공
  };

  // 학년별 및 검색 필터링
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      if (st.grade !== selectedGrade) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchName = st.name.toLowerCase().includes(q);
        const matchNum = `${st.grade}${st.classNum}${String(st.number).padStart(2, '0')}`.includes(q);
        return matchName || matchNum;
      }
      return true;
    });
  }, [students, selectedGrade, searchQuery]);

  // 실시간 통계
  const stats = useMemo(() => {
    return calculateDailySessionStats(students, session, selectedDateStr, records);
  }, [students, session, selectedDateStr, records]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12 select-none">
      {/* Kiosk Header Bar */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 rounded-3xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-indigo-700/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-indigo-300">
            <Sparkles className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-indigo-300 uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30">
                자습실 키오스크 모드
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {session === 'morning' ? '오전자습 (08:00~)' : '야간자습 (17:00~)'}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-0.5">
              학생 출석 셀프 체크인
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right px-4 py-2 bg-black/25 backdrop-blur-md rounded-2xl border border-white/10">
            <div className="text-[11px] font-semibold text-indigo-200">현재 시각</div>
            <div className="text-xl font-black font-mono tracking-wider text-emerald-400">
              {currentTimeStr}
            </div>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-3 rounded-2xl border transition-all ${
              soundEnabled
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-white/10 border-white/10 text-slate-400 hover:bg-white/20'
            }`}
            title={soundEnabled ? '음성 피드백 켜짐' : '음성 피드백 꺼짐'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={onExitKiosk}
            className="flex items-center gap-1.5 px-4 py-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs rounded-2xl border border-white/15 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>키오스크 종료</span>
          </button>
        </div>
      </div>

      {/* Realtime Attendance Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">전체 대상자</div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              {stats.applicableCount}명
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">출석 완료</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.presentCount}명
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">인정 / 사유</div>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400">
              {stats.excusedCount}명
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">미체크 / 결석</div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400">
              {stats.absentCount + stats.noneCount}명
            </div>
          </div>
        </div>
      </div>

      {/* Grade Selector & Search Filter */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Large Grade Tabs */}
        <div className="flex items-center gap-2">
          {[3, 2, 1].map((gradeNum) => {
            const gradeStudentCount = students.filter(s => s.grade === gradeNum).length;
            const isSel = selectedGrade === gradeNum;
            return (
              <button
                key={gradeNum}
                onClick={() => {
                  setSelectedGrade(gradeNum);
                  setSearchQuery('');
                }}
                className={`px-6 py-3 rounded-2xl font-black text-base transition-all flex items-center gap-2 ${
                  isSel
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{gradeNum}학년</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isSel ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {gradeStudentCount}명
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="이름 또는 학번 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {filteredStudents.map((st) => {
          const isExcluded = isStudentExcluded(st, session, selectedDateStr);
          const key = getRecordKey(st.id, session, selectedDateStr);
          const rec = records[key];
          const status = rec?.status || 'NONE';
          const badge = getStatusBadgeInfo(status, isExcluded);

          const isChecked = status === 'PRESENT' || status === 'EXCUSED';

          return (
            <button
              key={st.id}
              disabled={isExcluded}
              onClick={() => handleOpenStudentModal(st)}
              className={`relative p-4 rounded-3xl border-2 transition-all flex flex-col justify-between text-left min-h-[120px] ${
                isExcluded
                  ? 'bg-slate-100/70 dark:bg-slate-800/30 border-dashed border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                  : isChecked
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10 hover:border-emerald-600 active:scale-95'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:shadow-lg hover:scale-[1.02] active:scale-95'
              }`}
            >
              {/* Header: Class & Number */}
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-slate-400 dark:text-slate-500">
                  {st.grade}학년 {st.classNum}반 {st.number}번
                </span>
                {rec?.checkInTime && (
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {rec.checkInTime}
                  </span>
                )}
              </div>

              {/* Center: Name */}
              <div className="my-1">
                <span className={`text-xl font-black tracking-tight ${
                  isExcluded ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {st.name}
                </span>
              </div>

              {/* Footer: Status Badge */}
              <div className="flex items-center justify-between w-full mt-1">
                <span className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl ${badge.bgClass} ${badge.textClass}`}>
                  {badge.icon} {badge.label}
                </span>

                {rec?.reason && rec.reason.trim() !== '' && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 truncate max-w-[80px]">
                    💬 {rec.reason}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Check-in Modal */}
      {activeModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-7 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-black text-xs rounded-full">
                  {activeModalStudent.grade}학년 {activeModalStudent.classNum}반 {activeModalStudent.number}번
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {session === 'morning' ? '오전자습' : '야간자습'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* 사유 입력 중일 때는 타이머 일시정지 상태 표시 */}
                {isTypingReason ? (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 px-2.5 py-1 rounded-full animate-pulse">
                    입력 중 (타이머 일시정지)
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    {autoCloseTimer}초 후 자동 닫힘
                  </span>
                )}
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Student Name Display */}
            <div className="text-center py-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {activeModalStudent.name}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-1">
                원하시는 출석 상태 버튼을 터치해 주세요.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleCheckin('PRESENT')}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black shadow-lg shadow-emerald-500/25 transition-all"
              >
                <CheckCircle2 className="w-8 h-8" />
                <span className="text-sm">출석 (O)</span>
              </button>

              <button
                onClick={() => handleCheckin('EXCUSED')}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-black shadow-lg shadow-blue-500/25 transition-all"
              >
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm">인정 (인)</span>
              </button>

              <button
                onClick={() => handleCheckin('ABSENT')}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black shadow-lg shadow-rose-500/25 transition-all"
              >
                <XCircle className="w-8 h-8" />
                <span className="text-sm">결석 (X)</span>
              </button>
            </div>

            {/* Reason Input Box */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  사유 및 특이사항 입력
                </span>
                <span className="text-[11px] font-normal text-slate-400">
                  (클릭하여 선택 또는 직접 입력)
                </span>
              </div>

              {/* Direct Input Field */}
              <input
                type="text"
                placeholder="예: 병원 진료, 조퇴(학원), 보강, 학교 행사..."
                value={modalReason}
                onFocus={() => setIsTypingReason(true)}
                onChange={(e) => {
                  setModalReason(e.target.value);
                  setIsTypingReason(true);
                }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {/* Preset Quick Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddPresetReason(preset)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200/60 dark:border-slate-700/60"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleCheckin('NONE')}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                체크 초기화
              </button>
              <button
                onClick={handleCloseModal}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {lastCheckinToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-bottom-5">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black">
              {lastCheckinToast.name} 학생 체크 완료!
            </div>
            <div className="text-xs text-slate-400 font-mono">
              시간: {lastCheckinToast.time} | 상태: {lastCheckinToast.status === 'PRESENT' ? '출석' : lastCheckinToast.status === 'EXCUSED' ? '인정' : '결석'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
