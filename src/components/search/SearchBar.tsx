import React, { useState } from 'react';
import { SearchAppearance } from '../../services/storage/types';
import { Search as SearchIcon } from 'lucide-react';

export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  queryParam: string;
}

export const SEARCH_ENGINES: SearchEngine[] = [
  { id: 'bing', name: '必应', url: 'https://www.bing.com/search', queryParam: 'q' },
  { id: 'google', name: '谷歌', url: 'https://www.google.com/search', queryParam: 'q' },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search', queryParam: 'q' },
  { id: 'bilibili', name: 'Bilibili', url: 'https://search.bilibili.com/all', queryParam: 'keyword' },
];

/**
 * 引擎标准化 SVG 图标（保证 18x18px 严格统一尺寸与矢量规范）
 */
export const EngineIcon: React.FC<{ engineId: string; className?: string }> = ({
  engineId,
  className = 'w-[18px] h-[18px]',
}) => {
  switch (engineId) {
    case 'bing':
      return (
        <svg viewBox="0 0 24 24" className={`${className} flex-shrink-0`} fill="currentColor">
          <path d="M5 3v18l6.8-3.9 4.2 2.4 3-1.8-5-4.5 5.5-3.3-7.5-4.7L5 3z" fill="#008373" />
          <path d="M5 3l7 4.5-2.5 4-4.5-2V3z" fill="#00a4ef" />
        </svg>
      );
    case 'google':
      return (
        <svg viewBox="0 0 24 24" className={`${className} flex-shrink-0`}>
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.15C3.26 21.31 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.28C.46 8.21 0 10.05 0 12s.46 3.79 1.28 5.42l4-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.69 1.28 6.58l4 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
      );
    case 'github':
      return (
        <svg
          viewBox="0 0 24 24"
          className={`${className} flex-shrink-0 text-stone-800 dark:text-stone-100`}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          />
        </svg>
      );
    case 'bilibili':
      return (
        <svg viewBox="0 0 24 24" className={`${className} flex-shrink-0`} fill="none">
          <rect x="2" y="5" width="20" height="15" rx="4" fill="#00A1D6" />
          <path d="M7 2.5L9.5 5" stroke="#00A1D6" strokeWidth="2" strokeLinecap="round" />
          <path d="M17 2.5L14.5 5" stroke="#00A1D6" strokeWidth="2" strokeLinecap="round" />
          <circle cx="8.5" cy="11.5" r="1.5" fill="#FFFFFF" />
          <circle cx="15.5" cy="11.5" r="1.5" fill="#FFFFFF" />
          <path d="M10.5 15.5C11 16 13 16 13.5 15.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return <SearchIcon className={`${className} text-stone-500`} />;
  }
};

interface SearchBarProps {
  appearance: SearchAppearance;
  engineId: string;
  onEngineChange: (engineId: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  appearance,
  engineId,
  onEngineChange,
}) => {
  const [query, setQuery] = useState('');
  const [showEngineMenu, setShowEngineMenu] = useState(false);

  const currentEngine = SEARCH_ENGINES.find((e) => e.id === engineId) || SEARCH_ENGINES[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const url = `${currentEngine.url}?${encodeURIComponent(currentEngine.queryParam)}=${encodeURIComponent(trimmed)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
  };

  const alignClass =
    appearance.align === 'left'
      ? 'justify-start'
      : appearance.align === 'right'
      ? 'justify-end'
      : 'justify-center';

  const opacity = 1 - appearance.transparency / 100;
  const blurPx = appearance.blur;

  return (
    <div
      className={`relative z-20 w-full flex ${alignClass}`}
      style={{
        marginTop: `${appearance.gap}px`,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center transition-all duration-200 border border-black/10 dark:border-white/15 shadow-sm hover:shadow-md focus-within:shadow-md"
        style={{
          width: '100%',
          maxWidth: `${appearance.width}px`,
          backgroundColor: `rgba(255, 255, 255, ${opacity})`,
          backdropFilter: `blur(${blurPx}px)`,
          WebkitBackdropFilter: `blur(${blurPx}px)`,
          borderRadius: `${appearance.radius ?? 24}px`,
        }}
      >
        {/* Engine switcher toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEngineMenu(!showEngineMenu)}
            className="flex items-center justify-center pl-3.5 pr-2 py-3 transition-transform hover:scale-105 active:scale-95 cursor-pointer select-none"
            title={`当前搜索引擎：${currentEngine.name}（点击切换）`}
          >
            <div className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0">
              <EngineIcon engineId={currentEngine.id} />
            </div>
          </button>

          {/* 全屏透明点击捕获层：点击空白处自动收起菜单 (C009) */}
          {showEngineMenu && (
            <div
              className="fixed inset-0 z-40 bg-transparent cursor-default"
              onClick={() => setShowEngineMenu(false)}
            />
          )}

          {/* Engine dropdown menu (T11 & C009: 同质化毛玻璃外观 + 置顶 z-50 防遮挡) */}
          {showEngineMenu && (
            <div
              className="origin-menu absolute left-0 top-full mt-2 w-36 py-1.5 border border-black/10 dark:border-white/15 shadow-xl z-50 overflow-hidden"
              style={{
                backgroundColor: `rgba(255, 255, 255, ${opacity})`,
                backdropFilter: `blur(${blurPx}px)`,
                WebkitBackdropFilter: `blur(${blurPx}px)`,
                borderRadius: `${Math.min(appearance.radius ?? 24, 18)}px`,
              }}
            >
              {SEARCH_ENGINES.map((engine) => (
                <button
                  key={engine.id}
                  type="button"
                  onClick={() => {
                    onEngineChange(engine.id);
                    setShowEngineMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center space-x-2.5 cursor-pointer ${
                    engine.id === currentEngine.id
                      ? 'bg-black/10 dark:bg-white/15 text-stone-900 dark:text-white font-medium'
                      : 'text-stone-700 dark:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <div className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0">
                    <EngineIcon engineId={engine.id} />
                  </div>
                  <span className="flex-1 truncate">{engine.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input input box */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`在 ${currentEngine.name} 中搜索...`}
          className="flex-1 bg-transparent py-3 pr-4 pl-1 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none"
        />

        {/* Submit Search Button */}
        <button
          type="submit"
          className="pr-4 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          title="搜索"
        >
          <SearchIcon className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
