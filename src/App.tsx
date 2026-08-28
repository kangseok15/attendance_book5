/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceStatus, 
  AttendanceRecord,
  UserRole
} from './types/attendance';
import { 
  generateMonthDays 
} from './data/initialData';
import { 
  loadStudents, 
  saveStudents, 
  loadAttendanceRecords, 
  saveAttendanceRecords,
  loadUserRole,
  saveUserRole
} from './utils/storage';
import { Header, ViewTab } from './components/Header';
import { MonthlyGridView } from './components/MonthlyGridView';
import { DailyCheckinView } from './components/DailyCheckinView';
import { StudentRosterView } from './components/StudentRosterView';
import { AnalyticsView } from './components/AnalyticsView';
import { ParentNotificationModal } from './components/ParentNotificationModal';
import { GoogleSheetsExportModal } from './components/GoogleSheetsExportModal';
import { MonthConfigModal } from './components/MonthConfigModal';
import { RoleAuthModal } from './components/RoleAuthModal';
import { ClearAttendanceModal } from './components/ClearAttendanceModal';
import { KioskAttendanceView } from './components/KioskAttendanceView';
import { ShareLinksModal } from './components/ShareLinksModal';
import { 
  getRecordKey, 
  isStudentExcluded, 
  sortStudents, 
  getBestActiveDate, 
  getAutoSessionByCurrentTime 
} from './utils/attendanceHelpers';

// Firebase Firestore 연동
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './utils/firebase';

// Firebase 직렬화 헬퍼 (undefined 값을 안전하게 제거)
const sanitizeForFirestore = (record: AttendanceRecord): Record<string, any> => {
  const sanitized: Record<string, any> = {
    status: record.status
  };
  if (record.reason !== undefined && record.reason !== null) {
    sanitized.reason = record.reason;
  }
  if (record.checkInTime !== undefined && record.checkInTime !== null) {
    sanitized.checkInTime = record.checkInTime;
  }
  return sanitized;
};

export default function App() {
  const getInitialRole = (): UserRole => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role');
      if (urlRole === 'admin' || urlRole === 'teacher' || urlRole === 'student') {
        return urlRole as UserRole;
      }
      const hash = window.location.hash.replace(/^#/, '');
      if (hash === 'admin' || hash === 'teacher' || hash === 'student') {
        return hash as UserRole;
      }
      const hashParams = new URLSearchParams(hash);
      const hashRole = hashParams.get('role');
      if (hashRole === 'admin' || hashRole === 'teacher' || hashRole === 'student') {
        return hashRole as UserRole;
      }
    }
    return loadUserRole();
  };

  const getInitialTab = (role: UserRole): ViewTab => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'kiosk' || tabParam === 'daily' || tabParam === 'students' || tabParam === 'analytics' || tabParam === 'monthly') {
        return tabParam as ViewTab;
      }
      if (params.get('kiosk') === 'true' || window.location.hash.includes('kiosk')) {
        return 'kiosk';
      }
    }
    if (role === 'student') {
      return 'kiosk';
    }
    return 'monthly';
  };

  const [userRole, setUserRole] = useState<UserRole>(() => getInitialRole());
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [targetRoleToSwitch, setTargetRoleToSwitch] = useState<UserRole>(userRole);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('role') !== userRole) {
        url.searchParams.set('role', userRole);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [userRole]);

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      let urlRole = params.get('role');
      if (!urlRole) {
        const hash = window.location.hash.replace(/^#/, '');
        if (hash === 'admin' || hash === 'teacher' || hash === 'student') {
          urlRole = hash;
        } else {
          const hashParams = new URLSearchParams(hash);
          urlRole = hashParams.get('role');
        }
      }
      if (urlRole === 'admin' || urlRole === 'teacher' || urlRole === 'student') {
        const r = urlRole as UserRole;
        setUserRole(r);
        saveUserRole(r);
        if (r === 'student') {
          setActiveTab('kiosk');
        }
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<ViewTab>(() => getInitialTab(getInitialRole()));
  const [session, setSession] = useState<SessionType>('morning');
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(8);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'kiosk') {
      const autoSession = getAutoSessionByCurrentTime();
      setSession(autoSession);
      const interval = setInterval(() => {
        setSession(getAutoSessionByCurrentTime());
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    saveUserRole(newRole);
    if (newRole === 'student') {
      setSession(getAutoSessionByCurrentTime());
      setActiveTab('kiosk');
    } else if (newRole === 'teacher') {
      if (activeTab === 'daily' || activeTab === 'students' || activeTab === 'kiosk') {
        setActiveTab('monthly');
      }
    }
  };

  const handleOpenRoleModal = () => {
    setTargetRoleToSwitch(userRole);
    setIsRoleModalOpen(true);
  };

  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(() => 
    loadAttendanceRecords()
  );

  // Firestore 실시간 리스너 (학생 명단 + 출석 기록)
  useEffect(() => {
    const unsubStudents = onSnapshot(doc(db, 'attendance', 'students'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.list) && data.list.length > 0) {
          setStudents(data.list);
          saveStudents(data.list);
        }
      }
    });

    const monthKey = `records_${year}_${String(month).padStart(2, '0')}`;
    const unsubRecords = onSnapshot(doc(db, 'attendance', monthKey), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Record<string, AttendanceRecord>;
        setRecords(prev => {
          const merged = { ...prev, ...data };
          saveAttendanceRecords(merged);
          return merged;
        });
      }
    });

    return () => {
      unsubStudents();
      unsubRecords();
    };
  }, [year, month]);

  const handleUpdateStudents = async (newStudents: Student[]) => {
    const sorted = sortStudents(newStudents, [3, 2, 1], true);
    setStudents(sorted);
    saveStudents(sorted);
    try {
      await setDoc(doc(db, 'attendance', 'students'), { list: sorted });
    } catch (e) {
      console.error('Firestore 학생 업데이트 실패:', e);
    }
  };

  const [daysConfig, setDaysConfig] = useState<{
    morning: DayConfig[];
    night: DayConfig[];
  }>(() => ({
    morning: generateMonthDays(2026, 8, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31]),
    night: generateMonthDays(2026, 8, 'night', [20, 21, 24, 25, 27, 28, 31]),
  }));

  const allDaysInMonth = daysConfig[session] || [];
  const activeDays = useMemo(() => {
    return allDaysInMonth.filter(d => d.enabled);
  }, [allDaysInMonth]);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const initMorningActive = generateMonthDays(2026, 8, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31]).filter(d => d.enabled);
    return getBestActiveDate(initMorningActive, '2026-08-28');
  });

  useEffect(() => {
    if (activeDays.length > 0) {
      const best = getBestActiveDate(activeDays, selectedDateStr);
      if (best !== selectedDateStr) {
        setSelectedDateStr(best);
      }
    }
  }, [session, activeDays]);

  const handleTabChange = (tab: ViewTab) => {
    setActiveTab(tab);
    if (tab === 'daily' && activeDays.length > 0) {
      setSelectedDateStr(getBestActiveDate(activeDays));
    }
  };

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMonthConfigModalOpen, setIsMonthConfigModalOpen] = useState(false);
  const [isClearAttendanceModalOpen, setIsClearAttendanceModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [parentModalData, setParentModalData] = useState<{
    isOpen: boolean;
    dateStr: string;
    list: { student: Student; status: AttendanceStatus; reason?: string }[];
  }>({
    isOpen: false,
    dateStr: '2026-08-19',
    list: [],
  });

  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const freshStudents = loadStudents();
      const freshRecords = loadAttendanceRecords();
      setStudents(freshStudents);
      setRecords(freshRecords);
      
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastSyncedTime(timeStr);
      setIsSyncing(false);
      setSyncToast(`동기화 완료 (${timeStr})`);
      setTimeout(() => setSyncToast(null), 3000);
    }, 350);
  };

  const handleSetYearMonth = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
    const newMorningDays = (newMonth === 8 && newYear === 2026)
      ? generateMonthDays(newYear, newMonth, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31])
      : generateMonthDays(newYear, newMonth, 'morning');
    const newNightDays = (newMonth === 8 && newYear === 2026)
      ? generateMonthDays(newYear, newMonth, 'night', [20, 21, 24, 25, 27, 28, 31])
      : generateMonthDays(newYear, newMonth, 'night');

    setDaysConfig({
      morning: newMorningDays,
      night: newNightDays,
    });
    const activeForCurrent = (session === 'morning' ? newMorningDays : newNightDays).filter(d => d.enabled);
    if (activeForCurrent.length > 0) {
      setSelectedDateStr(activeForCurrent[0].dateStr);
    }
  };

  // 단일 출석 변경 (undefined 방지 처리 완료)
  const handleUpdateRecord = async (
    studentId: string,
    dateStr: string,
    status: AttendanceStatus,
    reason?: string,
    checkInTime?: string
  ) => {
    const key = getRecordKey(studentId, session, dateStr);
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    let finalCheckInTime: string | undefined = undefined;
    if (status !== 'NONE') {
      finalCheckInTime = checkInTime !== undefined 
        ? checkInTime 
        : (records[key]?.checkInTime || currentTimestamp);
    }

    const updatedRecord: AttendanceRecord = {
      status,
      reason: reason !== undefined ? reason : records[key]?.reason,
      checkInTime: finalCheckInTime,
    };

    const newRecords = {
      ...records,
      [key]: updatedRecord,
    };

    setRecords(newRecords);
    saveAttendanceRecords(newRecords);

    // Firestore 저장 시 undefined 필드를 안전하게 필터링하여 저장
    const monthKey = `records_${year}_${String(month).padStart(2, '0')}`;
    try {
      const firestoreSafeData = sanitizeForFirestore(updatedRecord);
      await setDoc(doc(db, 'attendance', monthKey), { [key]: firestoreSafeData }, { merge: true });
    } catch (e) {
      console.error('Firestore 출석 기록 저장 실패:', e);
    }
  };

  // 일괄 출석 처리 (undefined 방지 처리 완료)
  const handleBatchUpdateDay = async (
    dateStr: string,
    status: AttendanceStatus,
    gradeFilter?: number
  ) => {
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const updated = { ...records };
    const changedBatch: Record<string, any> = {};

    students
      .filter(st => st.active && !isStudentExcluded(st, session, dateStr) && (gradeFilter === undefined || st.grade === gradeFilter))
      .forEach(st => {
        const key = getRecordKey(st.id, session, dateStr);
        const recordVal: AttendanceRecord = {
          status,
          reason: records[key]?.reason,
          checkInTime: status !== 'NONE' ? (records[key]?.checkInTime || currentTimestamp) : undefined,
        };
        updated[key] = recordVal;
        changedBatch[key] = sanitizeForFirestore(recordVal);
      });

    setRecords(updated);
    saveAttendanceRecords(updated);

    const monthKey = `records_${year}_${String(month).padStart(2, '0')}`;
    try {
      await setDoc(doc(db, 'attendance', monthKey), changedBatch, { merge: true });
    } catch (e) {
      console.error('Firestore 일괄 기록 실패:', e);
    }
  };

  const [lastFilledDayKeys, setLastFilledDayKeys] = useState<Record<string, string[]>>({});

  const handleFillDayAbsent = async (dateStr: string, gradeFilter?: number) => {
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const trackingKey = `${session}_${dateStr}_${gradeFilter ?? 'all'}`;
    const updated = { ...records };
    const changedBatch: Record<string, any> = {};

    const applicableStudents = students.filter(
      st => st.active && !isStudentExcluded(st, session, dateStr) && (gradeFilter === undefined || st.grade === gradeFilter)
    );

    const emptyKeys: string[] = [];
    applicableStudents.forEach(st => {
      const key = getRecordKey(st.id, session, dateStr);
      const status = updated[key]?.status;
      if (!status || status === 'NONE') {
        emptyKeys.push(key);
      }
    });

    if (emptyKeys.length > 0) {
      emptyKeys.forEach(key => {
        const recVal: AttendanceRecord = {
          status: 'ABSENT',
          reason: updated[key]?.reason,
          checkInTime: currentTimestamp,
        };
        updated[key] = recVal;
        changedBatch[key] = sanitizeForFirestore(recVal);
      });
      setLastFilledDayKeys(map => ({
        ...map,
        [trackingKey]: emptyKeys,
      }));
    } else {
      const previousKeys = lastFilledDayKeys[trackingKey] || [];
      applicableStudents.forEach(st => {
        const key = getRecordKey(st.id, session, dateStr);
        if (updated[key]?.status === 'ABSENT') {
          const recVal: AttendanceRecord = {
            status: 'NONE',
            reason: updated[key]?.reason,
            checkInTime: undefined,
          };
          updated[key] = recVal;
          changedBatch[key] = sanitizeForFirestore(recVal);
        }
      });
      setLastFilledDayKeys(map => {
        const next = { ...map };
        delete next[trackingKey];
        return next;
      });
    }

    setRecords(updated);
    saveAttendanceRecords(updated);

    const monthKey = `records_${year}_${String(month).padStart(2, '0')}`;
    try {
      await setDoc(doc(db, 'attendance', monthKey), changedBatch, { merge: true });
    } catch (e) {
      console.error('Firestore 미체크 결석처리 실패:', e);
    }
  };

  const handleToggleDay = (dateStr: string) => {
    setDaysConfig(prev => ({
      ...prev,
      [session]: prev[session].map(d => (d.dateStr === dateStr ? { ...d, enabled: !d.enabled } : d)),
    }));
  };

  const handleSetPreset = (preset: 'standard' | 'weekdays' | 'sample8' | 'all' | 'none') => {
    if (preset === 'standard') {
      const stdDays = month === 8 && year === 2026
        ? (session === 'morning'
            ? generateMonthDays(year, month, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31])
            : generateMonthDays(year, month, 'night', [20, 21, 24, 25, 27, 28, 31]))
        : generateMonthDays(year, month, session);
      setDaysConfig(prev => ({
        ...prev,
        [session]: stdDays,
      }));
      return;
    }

    setDaysConfig(prev => ({
      ...prev,
      [session]: prev[session].map(d => {
        let isEn = false;
        if (preset === 'weekdays') {
          if (session === 'night') {
            isEn = d.dayOfWeek !== '토' && d.dayOfWeek !== '일' && d.dayOfWeek !== '수';
          } else {
            isEn = d.dayOfWeek !== '토' && d.dayOfWeek !== '일';
          }
        } else if (preset === 'sample8') {
          if (session === 'night') {
            isEn = [20, 21, 24, 25, 27, 28, 31].includes(d.dayNum);
          } else {
            isEn = [19, 20, 21, 24, 25, 26, 27, 28, 31].includes(d.dayNum);
          }
        } else if (preset === 'all') {
          isEn = true;
        } else if (preset === 'none') {
          isEn = false;
        }
        return { ...d, enabled: isEn };
      }),
    }));
  };

  const handleClearDate = (dateStr: string, gradeFilter?: number) => {
    setRecords(prev => {
      const updated = { ...prev };
      students
        .filter(st => gradeFilter === undefined || st.grade === gradeFilter)
        .forEach(st => {
          const key = getRecordKey(st.id, session, dateStr);
          delete updated[key];
        });
      saveAttendanceRecords(updated);
      return updated;
    });
  };

  const handleClearMonthSession = (targetYear: number, targetMonth: number, targetSession: SessionType) => {
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    setRecords(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        const parts = key.split('_');
        if (parts.length >= 3) {
          const keySession = parts[1];
          const keyDate = parts[2];
          if (keySession === targetSession && keyDate.startsWith(monthPrefix)) {
            delete updated[key];
          }
        }
      });
      saveAttendanceRecords(updated);
      return updated;
    });
  };

  const handleClearAll = () => {
    setRecords({});
    saveAttendanceRecords({});
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        session={session}
        setSession={setSession}
        year={year}
        month={month}
        setYearMonth={handleSetYearMonth}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenMonthConfigModal={() => setIsMonthConfigModalOpen(true)}
        onClearAttendance={() => setIsClearAttendanceModalOpen(true)}
        studentCount={students.length}
        userRole={userRole}
        onOpenRoleModal={handleOpenRoleModal}
        onDirectSelectRole={handleRoleChange}
        lastSyncedTime={lastSyncedTime}
        isSyncing={isSyncing}
        onSync={handleSync}
        onOpenShareModal={() => setIsShareModalOpen(true)}
      />

      {syncToast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg border border-slate-700 animate-in fade-in">
          {syncToast}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'monthly' && (
          <MonthlyGridView
            students={students}
            session={session}
            year={year}
            month={month}
            activeDays={activeDays}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onBatchUpdateDay={handleBatchUpdateDay}
            onFillDayAbsent={handleFillDayAbsent}
            onUpdateStudents={handleUpdateStudents}
            onSessionChange={setSession}
            onMonthChange={(newMonth) => handleSetYearMonth(year, newMonth)}
            userRole={userRole}
          />
        )}

        {activeTab === 'daily' && (
          <DailyCheckinView
            students={students}
            session={session}
            setSession={setSession}
            activeDays={activeDays}
            selectedDateStr={selectedDateStr}
            setSelectedDateStr={setSelectedDateStr}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onBatchUpdateDay={handleBatchUpdateDay}
            onFillDayAbsent={handleFillDayAbsent}
            onOpenParentModal={list => {
              setParentModalData({
                isOpen: true,
                dateStr: selectedDateStr,
                list,
              });
            }}
            userRole={userRole}
          />
        )}

        {activeTab === 'students' && (
          <StudentRosterView
            students={students}
            onUpdateStudents={handleUpdateStudents}
            userRole={userRole}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            students={students}
            session={session}
            year={year}
            month={month}
            activeDays={activeDays}
            records={records}
            userRole={userRole}
          />
        )}

        {activeTab === 'kiosk' && (
          <KioskAttendanceView
            students={students}
            session={session}
            setSession={setSession}
            activeDays={activeDays}
            selectedDateStr={selectedDateStr}
            setSelectedDateStr={setSelectedDateStr}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            userRole={userRole}
            onExitKiosk={() => setActiveTab('monthly')}
          />
        )}
      </main>

      {/* Modals */}
      <RoleAuthModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        targetRole={targetRoleToSwitch}
        currentRole={userRole}
        onConfirmRole={handleRoleChange}
      />

      <GoogleSheetsExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        session={session}
        year={year}
        month={month}
        activeDays={activeDays}
        students={students}
        records={records}
      />

      <MonthConfigModal
        isOpen={isMonthConfigModalOpen}
        onClose={() => setIsMonthConfigModalOpen(false)}
        session={session}
        year={year}
        month={month}
        allDaysInMonth={allDaysInMonth}
        onToggleDay={handleToggleDay}
        onSetPreset={handleSetPreset}
        onSelectMonth={(newMonth) => handleSetYearMonth(year, newMonth)}
        onSelectSession={setSession}
      />

      <ParentNotificationModal
        isOpen={parentModalData.isOpen}
        onClose={() => setParentModalData(prev => ({ ...prev, isOpen: false }))}
        session={session}
        dateStr={parentModalData.dateStr}
        absentList={parentModalData.list}
      />

      <ClearAttendanceModal
        isOpen={isClearAttendanceModalOpen}
        onClose={() => setIsClearAttendanceModalOpen(false)}
        year={year}
        month={month}
        session={session}
        activeDays={activeDays}
        currentSelectedDateStr={selectedDateStr}
        onClearDate={handleClearDate}
        onClearMonthSession={handleClearMonthSession}
        onClearAll={handleClearAll}
      />

      <ShareLinksModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
