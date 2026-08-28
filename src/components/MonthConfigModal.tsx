import React from 'react';
import { DayConfig, SessionType } from '../types/attendance';
import { Settings2, Calendar, Check, Info, Sun, Moon } from 'lucide-react';
import { SPECIAL_CALENDAR_EVENTS } from '../data/initialData';

interface MonthConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionType;
  year: number;
  month: number;
  allDaysInMonth: DayConfig[];
  onToggleDay: (dateStr: string) => void;
  onSetPreset: (preset: 'standard' | 'weekdays' | 'sample8' | 'all' | 'none') => void;
  onSelectMonth?: (month: number) => void;
  onSelectSession?: (session: SessionType) => void;
}

export const MonthConfigModal: React.FC<MonthConfigModalProps> = ({
  isOpen,
  onClose,
  session,
  year,
  month,
  allDaysInMonth,
  onToggleDay,
  onSetPreset,
  onSelectMonth,
  onSelectSession,
}) => {
  if (!isOpen) return null;

  const activeCount = allDaysInMonth.filter(d => d.enabled).length;
  const sessionLabel = session === 'morning' ? '아침' : '야간';
  const availableMonths = [8, 9, 10, 11, 12];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${session === 'morning' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'}`}>
              {session === 'morning' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>{year}년 {month}월 <span className={session === 'morning' ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}>{sessionLabel}</span> 자율학습 운영일 설정</span>
              </h3>
              <p className="text-xs text-slate-500">
                출석부에 표시할 운영일을 선택하세요 (현재 <span className="font-bold text-indigo-600 dark:text-indigo-400">{activeCount}일</span> 활성화)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">

          {/* Month & Session Direct Selectors */}
          <div className="bg-slate-50 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            {/* 1. Month Selector */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                월 선택 (2학기):
              </span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {availableMonths.map(m => (
                  <button
                    key={`modal-m-${m}`}
                    type="button"
                    onClick={() => onSelectMonth && onSelectMonth(m)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      month === m
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {m}월
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Session Selector */}
            <div className="flex items-center justify-between gap-2 flex-wrap border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                자율학습 구분:
              </span>
              <div className="inline-flex p-0.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => onSelectSession && onSelectSession('morning')}
                  className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    session === 'morning'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>아침 자율학습</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSession && onSelectSession('night')}
                  className={`px-3.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    session === 'night'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>야간 자율학습(야자)</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Notice Box about Exclusions */}
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-900 dark:text-indigo-200 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-xs">
              <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{month}월 자율학습 운영 안내 및 2학기 학사일정</span>
            </div>
            <div className="p-2 bg-white/80 dark:bg-slate-900/60 rounded-lg border border-indigo-200/60 dark:border-indigo-900 font-semibold text-2xs space-y-1">
              <div className="text-indigo-950 dark:text-indigo-200">
                🌙 <strong className="text-indigo-700 dark:text-indigo-300">야간 자율학습(야자)</strong>: 8월~12월 <strong>매주 수요일 야자 미실시 (출석부에서 수요일 제외)</strong>
              </div>
              <div className="text-amber-900 dark:text-amber-300">
                🌅 <strong className="text-amber-700 dark:text-amber-300">아침 자율학습</strong>: 수요일 포함 월~금 정상 운영 (개학 8/19부터)
              </div>
            </div>
            <ul className="text-2xs space-y-0.5 text-indigo-800/90 dark:text-indigo-300 list-disc list-inside mt-1">
              {month === 8 && <li>8월 19일(수) 2학기 개학 (8/19부터 자율학습 운영 시작)</li>}
              <li>9월 2일(모의고사), 9월 23일(재량휴업일), 9월 24~26일(추석)</li>
              <li>10월 3일(개천절), 10월 5일(재량휴업일), 10월 9일(한글날)</li>
              <li>10월 13~16일(중간고사), 10월 20일(모의고사)</li>
              <li>11월 18~19일(수능), <strong>11월 17일 이후 3학년 출석부 자동 제외</strong></li>
              <li>12월 15~19일(기말고사), 12월 25일(성탄절)</li>
            </ul>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
              빠른 설정 프리셋 ({sessionLabel} 기준)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => onSetPreset('standard')}
                className="p-2.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors text-center shadow-xs cursor-pointer"
              >
                {sessionLabel} 학사일정 기본값
              </button>
              <button
                onClick={() => onSetPreset('weekdays')}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-100 transition-colors text-center cursor-pointer"
              >
                {session === 'night' ? '평일 (수요일 제외)' : '모든 평일 (월~금)'}
              </button>
              <button
                onClick={() => onSetPreset('none')}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-100 transition-colors text-center cursor-pointer"
              >
                전체 해제
              </button>
            </div>
          </div>

          {/* Calendar Day Picker Grid */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
              일자별 개별 선택 (클릭하여 켜기/끄기)
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {['일', '월', '화', '수', '목', '금', '토'].map((dw, idx) => (
                <div key={dw} className={`text-center font-bold text-3xs py-1 ${
                  idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : dw === '수' && session === 'night' ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400'
                }`}>
                  {dw}{dw === '수' && session === 'night' ? '(야자X)' : ''}
                </div>
              ))}

              {/* 1일 시작 요일에 맞추기 위한 앞쪽 빈칸 패딩 */}
              {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, padIdx) => (
                <div key={`cal-pad-${padIdx}`} className="min-h-12 rounded-xl bg-slate-50/40 dark:bg-slate-800/30 border border-dashed border-slate-200/60 dark:border-slate-800 pointer-events-none" />
              ))}

              {allDaysInMonth.map(d => {
                const isSun = d.dayOfWeek === '일';
                const isSat = d.dayOfWeek === '토';
                const isWed = d.dayOfWeek === '수';
                const eventInfo = SPECIAL_CALENDAR_EVENTS[d.dateStr];

                return (
                  <button
                    key={d.dateStr}
                    onClick={() => onToggleDay(d.dateStr)}
                    className={`py-2 px-1 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center relative min-h-12 cursor-pointer ${
                      d.enabled
                        ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                        : eventInfo
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400'
                        : isWed && session === 'night'
                        ? 'bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 text-slate-400'
                        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span>{d.dayNum}</span>
                    <span
                      className={`text-3xs font-normal ${
                        d.enabled
                          ? 'text-indigo-200'
                          : isSun
                          ? 'text-rose-400'
                          : isSat
                          ? 'text-blue-400'
                          : isWed && session === 'night'
                          ? 'text-slate-500 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {eventInfo ? eventInfo.label : (isWed && session === 'night' ? '야자X' : d.dayOfWeek)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/80 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
          >
            설정 완료
          </button>
        </div>

      </div>
    </div>
  );
};

