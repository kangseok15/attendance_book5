import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  GraduationCap, 
  UserCheck, 
  Globe, 
  Share2,
  Info
} from 'lucide-react';
import { UserRole } from '../types/attendance';

interface ShareLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
}

export function ShareLinksModal({
  isOpen,
  onClose,
}: ShareLinksModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  // Base URL resolution (Origin + Pathname without query/hash)
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      return `${origin}${pathname}`;
    }
    return '';
  };

  const baseUrl = getBaseUrl();

  const links = [
    {
      key: 'admin',
      role: 'admin' as UserRole,
      title: '관리자 전용 링크',
      badge: '전체 관리 & 설정',
      badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      icon: ShieldCheck,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50',
      description: '출석부 수정, 학생 명단 관리, 월별 일정 설정, 구글 스프레드시트/엑셀 내보내기 (PIN 인증)',
      queryUrl: `${baseUrl}?role=admin`,
      hashUrl: `${baseUrl}#admin`,
      defaultTab: '월간 출석부 / 명단 관리 / 통계'
    },
    {
      key: 'teacher',
      role: 'teacher' as UserRole,
      title: '담임교사 전용 링크',
      badge: '조회 전용 (출결 현황 & 통계)',
      badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800',
      icon: GraduationCap,
      iconColor: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/50',
      description: '반 학생들의 실시간 출석 현황, 월간 출석부 및 출석률 통계 열람 전용 (임의 수정 방지)',
      queryUrl: `${baseUrl}?role=teacher`,
      hashUrl: `${baseUrl}#teacher`,
      defaultTab: '월간 출석부 / 통계'
    },
    {
      key: 'student',
      role: 'student' as UserRole,
      title: '학생 및 키오스크 전용 링크',
      badge: '입실 체크 & 본인 출결',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      icon: UserCheck,
      iconColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/50',
      description: '교실 태블릿 입실 키오스크(음성 안내) 및 학생용 출석부 (아침 10시 / 야간 22시 마감)',
      queryUrl: `${baseUrl}?role=student`,
      hashUrl: `${baseUrl}#student`,
      defaultTab: '입실 키오스크 / 월간 출석부'
    }
  ];

  const handleCopy = (key: string, url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    });
  };

  const handleCopyAll = () => {
    const text = `[숭신고 미래인재반 자율학습 출결 링크 안내]

👑 1. 관리자 링크 (전체 관리 & 설정)
${links[0].queryUrl}

🎓 2. 담임교사 링크 (조회 전용)
${links[1].queryUrl}

📱 3. 학생 / 교실 키오스크 링크 (입실 체크 & 출석부)
${links[2].queryUrl}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey('all');
      setTimeout(() => setCopiedKey(null), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>역할별 전용 접속 링크</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                  GitHub 배포 지원
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                관리자, 담임교사, 학생이 각각 서로 다른 전용 화면으로 바로 진입할 수 있는 링크입니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-850 dark:text-slate-150">
          
          {/* GitHub 안내 팁 박스 */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                깃허브(GitHub Pages 또는 웹 호스팅)에 업로드한 후에도 그대로 동작합니다!
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                현재 시스템에 역할별 URL 라우팅이 이미 내장되어 있습니다. 깃허브에 올린 후 발급되는 주소 뒤에 <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">?role=admin</code>, <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">?role=teacher</code>, <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">?role=student</code> (또는 <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">#admin</code>, <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">#teacher</code>, <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[11px]">#student</code>)를 붙여 배포하시면 됩니다.
              </p>
            </div>
          </div>

          {/* Links List */}
          <div className="space-y-3">
            {links.map((item) => {
              const Icon = item.icon;
              const isCopied = copiedKey === item.key;
              const isCopiedHash = copiedKey === `${item.key}_hash`;

              return (
                <div 
                  key={item.key}
                  className={`p-3.5 sm:p-4 rounded-xl border ${item.bgColor} transition-all`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-2xs ${item.iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Primary Link Input & Copy */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          readOnly
                          value={item.queryUrl}
                          className="w-full pl-3 pr-8 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-hidden select-all"
                        />
                        <Globe className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      <button
                        onClick={() => handleCopy(item.key, item.queryUrl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>복사됨!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>링크 복사</span>
                          </>
                        )}
                      </button>

                      <a
                        href={item.queryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                        title="새 창에서 열기"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Alternative Hash Link */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                      <span>대체 해시 URL: <code className="font-mono">{item.hashUrl}</code></span>
                      <button
                        onClick={() => handleCopy(`${item.key}_hash`, item.hashUrl)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-semibold ml-2"
                      >
                        {isCopiedHash ? '해시 복사됨' : '해시 복사'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-850/80 flex-wrap">
          <button
            onClick={handleCopyAll}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
              copiedKey === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white'
            }`}
          >
            {copiedKey === 'all' ? (
              <>
                <Check className="w-4 h-4" />
                <span>3개 전체 안내문 복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>3개 역할 전체 링크 한번에 복사</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
