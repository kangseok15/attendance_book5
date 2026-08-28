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
import { getRecordKey, isStudentExcluded, isStudentExcludedOnDate, sortStudents, getBestActiveDate, getAutoSessionByCurrentTime } from './utils/attendanceHelpers';

export default function App() {
  // Helper to get initial role from URL param, hash or storage
  const getInitialRole = (): UserRole => {
    if (typeof window !== 'undefined') {
      // 1. Search Query Params (?role=teacher)
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role');
      if (urlRole === 'admin' || urlRole === 'teacher' || urlRole === 'student') {
        return urlRole as UserRole;
      }

      // 2. Hash params (#role=teacher or #teacher)
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

  // Helper to get initial tab from URL if present (defaults to kiosk for student)
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

  // User Role State: 'admin' | 'teacher' | 'student'
  const [userRole, setUserRole] = useState<UserRole>(() => getInitialRole());
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [targetRoleToSwitch, setTargetRoleToSwitch] = useState<UserRole>(userRole);

  // Sync URL when userRole changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('role') !== userRole) {
        url.searchParams.set('role', userRole);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [userRole]);

  // Listen for browser popstate, hashchange, or direct URL param changes
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

  // Navigation & Core State (defaults to 'kiosk' for student)
  const [activeTab, setActiveTab] = useState<ViewTab>(() => getInitialTab(getInitialRole()));
  const [session, setSession] = useState<SessionType>('morning');
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(8);

  // Sync tab in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [activeTab]);

  // Auto-sync session for Kiosk mode: morning (00:00~12:00) vs night (12:01~23:59)
  useEffect(() => {
    if (activeTab === 'kiosk') {
      const autoSession = getAutoSessionByCurrentTime();
      setSession(autoSession);

      // Periodically re-check every 30 seconds to switch when crossing 12:00 noon while in Kiosk
      const interval = setInterval(() => {
        setSession(getAutoSessionByCurrentTime());
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Handle Role Change
  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    saveUserRole(newRole);

    if (newRole === 'student') {
      setSession(getAutoSessionByCurrentTime());
      setActiveTab('kiosk');
    } else if (newRole === 'teacher') {
      // Teacher mode only has monthly and analytics
      if (activeTab === 'daily' || activeTab === 'students' || activeTab === 'kiosk') {
        setActiveTab('monthly');
      }
    }
  };

  // Open role modal
  const handleOpenRoleModal = () => {
    setTargetRoleToSwitch(userRole);
    setIsRoleModalOpen(true);
  };

  // Students & Records (Empty by default)
  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(() => 
    loadAttendanceRecords()
  );

  // Update students handler: always sort by grade, classNum, studentNum, name and reassign seq
  const handleUpdateStudents = (newStudents: Student[]) => {
    const sorted = sortStudents(newStudents, [3, 2, 1], true);
    setStudents(sorted);
    saveStudents(sorted);
  };

  // Month days configuration per session
  // 아침: 8월 19일(수), 20일(목), 21일(금), 24일(월), 25일(화), 26일(수), 27일(목), 28일(금), 31일(월)
  // 야간: 8월 20일(목), 21일(금), 24일(월), 25일(화), 27일(목), 28일(금), 31일(월) (수요일 미실시 제외)
  const [daysConfig, setDaysConfig] = useState<{
    morning: DayConfig[];
    night: DayConfig[];
  }>(() => ({
    morning: generateMonthDays(2026, 8, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31]),
    night: generateMonthDays(2026, 8, 'night', [20, 21, 24, 25, 27, 28, 31]),
  }));

  // Current session's full month days
  const allDaysInMonth = daysConfig[session] || [];

  // Active (enabled) days in this month for current session
  const activeDays = useMemo(() => {
    return allDaysInMonth.filter(d => d.enabled);
  }, [allDaysInMonth]);

  // Selected date for Daily Checkin View (Default to today or closest active date)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const initMorningActive = generateMonthDays(2026, 8, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31]).filter(d => d.enabled);
    return getBestActiveDate(initMorningActive, '2026-08-28');
  });

  // Adjust selectedDateStr if it's not active in current session or when session changes
  useEffect(() => {
    if (activeDays.length > 0) {
      const best = getBestActiveDate(activeDays, selectedDateStr);
      if (best !== selectedDateStr) {
        setSelectedDateStr(best);
      }
    }
  }, [session, activeDays]);

  // Tab change handler: when clicking 'daily', always ensure today's date is immediately selected
  const handleTabChange = (tab: ViewTab) => {
    setActiveTab(tab);
    if (tab === 'daily' && activeDays.length > 0) {
      setSelectedDateStr(getBestActiveDate(activeDays));
    }
  };

  // Modals state
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

  // Sync state & Cross-tab sync
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Cross-tab synchronization via StorageEvent & BroadcastChannel
  useEffect(() => {
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key && (e.key.includes('students') || e.key.includes('records') || e.key.includes('custom_days'))) {
        setStudents(loadStudents());
        setRecords(loadAttendanceRecords());
        const n = new Date();
        setLastSyncedTime(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`);
      }
    };

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('soongshin_attendance_sync');
        bc.onmessage = (event) => {
          if (event.data && event.data.type === 'SYNC') {
            setStudents(loadStudents());
            setRecords(loadAttendanceRecords());
            const n = new Date();
            setLastSyncedTime(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      if (bc) bc.close();
    };
  }, []);

  // Manual sync trigger
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

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('soongshin_attendance_sync');
          bc.postMessage({ type: 'SYNC', time: timeStr });
          bc.close();
        } catch (e) {
          // ignore
        }
      }

      setSyncToast(`데이터가 최신 상태로 동기화되었습니다 (${timeStr})`);
      setTimeout(() => setSyncToast(null), 3000);
    }, 350);
  };

  // When year or month changes (8월, 9월, 10월, 11월, 12월 등), regenerate month days for both sessions
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

  // Sync state to LocalStorage
  useEffect(() => {
    saveStudents(students);
  }, [students]);

  useEffect(() => {
    saveAttendanceRecords(records);
  }, [records]);

  // Update Single Record (with automatic check-in timestamp)
  const handleUpdateRecord = (
    studentId: string,
    dateStr: string,
    status: AttendanceStatus,
    reason?: string,
    checkInTime?: string
  ) => {
    const key = getRecordKey(studentId, session, dateStr);
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setRecords(prev => {
      let finalCheckInTime: string | undefined = undefined;
      if (status !== 'NONE') {
        finalCheckInTime = checkInTime !== undefined 
          ? checkInTime 
          : (prev[key]?.checkInTime || currentTimestamp);
      }

      const updated = {
        ...prev,
        [key]: {
          status,
          reason: reason !== undefined ? reason : prev[key]?.reason,
          checkInTime: finalCheckInTime,
        },
      };
      return updated;
    });
  };

  // Batch Update Entire Day for all or specific grade
  const handleBatchUpdateDay = (
    dateStr: string,
    status: AttendanceStatus,
    gradeFilter?: number
  ) => {
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setRecords(prev => {
      const updated = { ...prev };
      students
        .filter(st => st.active && !isStudentExcluded(st, session, dateStr) && (gradeFilter === undefined || st.grade === gradeFilter))
        .forEach(st => {
          const key = getRecordKey(st.id, session, dateStr);
          updated[key] = {
            status,
            reason: prev[key]?.reason,
            checkInTime: status !== 'NONE' ? (prev[key]?.checkInTime || currentTimestamp) : undefined,
          };
        });
      return updated;
    });
  };

  // Track keys that were filled from empty to ABSENT by day fill action, for undo/toggle capability
  const [lastFilledDayKeys, setLastFilledDayKeys] = useState<Record<string, string[]>>({});

  // Fill all blank/NONE cells for a given day with 'X' (ABSENT), or Revert them back to NONE if already filled
  const handleFillDayAbsent = (dateStr: string, gradeFilter?: number) => {
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const trackingKey = `${session}_${dateStr}_${gradeFilter ?? 'all'}`;

    setRecords(prev => {
      const updated = { ...prev };
      const applicableStudents = students.filter(
        st => st.active && !isStudentExcluded(st, session, dateStr) && (gradeFilter === undefined || st.grade === gradeFilter)
      );

      // Check which cells are currently blank/empty (NONE)
      const emptyKeys: string[] = [];
      applicableStudents.forEach(st => {
        const key = getRecordKey(st.id, session, dateStr);
        const status = prev[key]?.status;
        if (!status || status === 'NONE') {
          emptyKeys.push(key);
        }
      });

      // CASE 1: If there are empty cells -> Fill them with 'ABSENT' (X) and save keys for toggle/undo
      if (emptyKeys.length > 0) {
        emptyKeys.forEach(key => {
          updated[key] = {
            status: 'ABSENT',
            reason: prev[key]?.reason,
            checkInTime: currentTimestamp,
          };
        });
        setLastFilledDayKeys(map => ({
          ...map,
          [trackingKey]: emptyKeys,
        }));
        return updated;
      }

      // CASE 2: If there are NO empty cells -> Revert previously auto-filled 'ABSENT' cells back to 'NONE'
      const previousKeys = lastFilledDayKeys[trackingKey];
      if (previousKeys && previousKeys.length > 0) {
        // Revert the specifically auto-filled keys
        previousKeys.forEach(key => {
          if (updated[key]?.status === 'ABSENT') {
            updated[key] = {
              status: 'NONE',
              reason: prev[key]?.reason,
              checkInTime: undefined,
            };
          }
        });
        setLastFilledDayKeys(map => {
          const next = { ...map };
          delete next[trackingKey];
          return next;
        });
      } else {
        // Fallback: revert all 'ABSENT' cells for this day/filter back to 'NONE'
        applicableStudents.forEach(st => {
          const key = getRecordKey(st.id, session, dateStr);
          if (updated[key]?.status === 'ABSENT') {
            updated[key] = {
              status: 'NONE',
              reason: prev[key]?.reason,
              checkInTime: undefined,
            };
          }
        });
        setLastFilledDayKeys(map => {
          const next = { ...map };
          delete next[trackingKey];
          return next;
        });
      }

      return updated;
    });
  };

  // Toggle single day in month config for current session
  const handleToggleDay = (dateStr: string) => {
    setDaysConfig(prev => ({
      ...prev,
      [session]: prev[session].map(d => (d.dateStr === dateStr ? { ...d, enabled: !d.enabled } : d)),
    }));
  };

  // Set preset for month config for current session
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
          // Night session excludes Wednesdays
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

  // 1. 특정 날짜만 비우기 (일별 초기화)
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

  // 2. 해당 월 세션 전체 비우기 (월별 초기화)
  const handleClearMonthSession = (targetYear: number, targetMonth: number, targetSession: SessionType) => {
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    setRecords(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        // key format: `${studentId}_${session}_${dateStr}`
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

  // 3. 전체 출결 완전 초기화 (모든 기간/세션)
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
      />

      {/* Main Container with Bento Grid spacing */}
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

      {/* User Role Auth / Selector Modal */}
      <RoleAuthModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        targetRole={targetRoleToSwitch}
        currentRole={userRole}
        onConfirmRole={handleRoleChange}
      />

      {/* Export & Google Sheets Sync Modal */}
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

      {/* Month Config Modal */}
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

      {/* Parent Notification Modal */}
      <ParentNotificationModal
        isOpen={parentModalData.isOpen}
        onClose={() => setParentModalData(prev => ({ ...prev, isOpen: false }))}
        session={session}
        dateStr={parentModalData.dateStr}
        absentList={parentModalData.list}
      />

      {/* Clear Attendance Modal (Admin Only) */}
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

    </div>
  );
}
