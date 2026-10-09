import React, { useState, useRef, useEffect } from 'react';
import { SearchAppearance } from '../../services/storage/types';
import { Search as SearchIcon } from 'lucide-react';
import {
  fetchSuggestions,
  SuggestionItem,
} from '../../services/search/suggestionService';

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
  inputRef?: React.RefObject<HTMLInputElement>;
  onCycleEngine?: (direction: 'next' | 'prev') => void;
  textColor?: string;
  tone?: 'light' | 'dark';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  appearance,
  engineId,
  onEngineChange,
  inputRef,
  onCycleEngine,
  textColor = '#141c20',
  tone = 'dark',
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showEngineMenu, setShowEngineMenu] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const rawQueryRef = useRef('');

  const currentEngine = SEARCH_ENGINES.find((e) => e.id === engineId) || SEARCH_ENGINES[0];

  // 当输入变化或引擎切换时请求实时联想
  useEffect(() => {
    let isCancelled = false;
    const trimmed = query.trim();

    // 未获得焦点或内容为空时不获取联想
    if (!isFocused || !trimmed) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await fetchSuggestions(query, currentEngine.id);
        if (!isCancelled) {
          setSuggestions(results);
        }
      } catch {
        if (!isCancelled) {
          setSuggestions([]);
        }
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentEngine.id, isFocused]);

  // 全域点击关闭交互 (C011 & T13)：展开后点击页面任意位置或按 Escape 键均可关闭下拉框
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      // 若点击了下拉菜单内部的按钮，由按钮自身的 onClick 处理切换与收起
      if (menuRef.current && menuRef.current.contains(event.target as Node)) {
        return;
      }
      // 若点击了切换按钮自身，由切换按钮的 onClick 处理开关
      if (toggleButtonRef.current && toggleButtonRef.current.contains(event.target as Node)) {
        return;
      }

      // 点击外部统一收起引擎选择框
      setShowEngineMenu(false);

      // 若点击搜索容器外部，收起联想菜单
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEngineMenu(false);
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    window.addEventListener('click', handleGlobalClick, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleGlobalClick, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const executeSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    const url = `${currentEngine.url}?${encodeURIComponent(currentEngine.queryParam)}=${encodeURIComponent(trimmed)}`;
    // 当前页面跳转 (C016): 由原新标签页打开调整为在当前页面直接导航跳转
    window.location.href = url;
    setQuery('');
    rawQueryRef.current = '';
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      executeSearch(suggestions[selectedIndex].text);
    } else {
      executeSearch(query);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    rawQueryRef.current = val;
    setQuery(val);
    setSelectedIndex(-1);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      setShowSuggestions(true);
    }
  };

  const handleSelectSuggestion = (text: string) => {
    executeSearch(text);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      setShowSuggestions(false);
      if (onCycleEngine) {
        onCycleEngine(e.shiftKey ? 'prev' : 'next');
      } else {
        const currentIndex = SEARCH_ENGINES.findIndex((eng) => eng.id === currentEngine.id);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + SEARCH_ENGINES.length) % SEARCH_ENGINES.length
          : (currentIndex + 1) % SEARCH_ENGINES.length;
        onEngineChange(SEARCH_ENGINES[nextIndex].id);
      }
    } else if (e.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setShowSuggestions(true);
        const next = selectedIndex + 1 < suggestions.length ? selectedIndex + 1 : 0;
        setSelectedIndex(next);
        setQuery(suggestions[next].text);
      }
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setShowSuggestions(true);
        if (selectedIndex > 0) {
          const prev = selectedIndex - 1;
          setSelectedIndex(prev);
          setQuery(suggestions[prev].text);
        } else if (selectedIndex === 0) {
          setSelectedIndex(-1);
          setQuery(rawQueryRef.current);
        } else {
          const last = suggestions.length - 1;
          setSelectedIndex(last);
          setQuery(suggestions[last].text);
        }
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
      e.currentTarget.blur();
    }
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
      <div
        ref={containerRef}
        className="relative w-full"
        style={{
          maxWidth: `${appearance.width}px`,
        }}
      >
        <form
          onSubmit={handleSubmit}
          className={`relative flex items-center transition-all duration-200 border shadow-sm hover:shadow-md focus-within:shadow-md ${
            tone === 'light'
              ? 'border-white/20'
              : 'border-black/10 dark:border-white/15'
          }`}
          style={{
            width: '100%',
            backgroundColor: `rgba(255, 255, 255, ${opacity})`,
            backdropFilter: `blur(${blurPx}px)`,
            WebkitBackdropFilter: `blur(${blurPx}px)`,
            borderRadius: `${appearance.radius ?? 24}px`,
          }}
        >
          {/* Engine switcher toggle */}
          <div className="relative">
            <button
              ref={toggleButtonRef}
              type="button"
              onClick={() => {
                setShowEngineMenu(!showEngineMenu);
                setShowSuggestions(false);
              }}
              className="flex items-center justify-center pl-3.5 pr-2 py-3 transition-transform hover:scale-105 active:scale-95 cursor-pointer select-none"
              title={`当前搜索引擎：${currentEngine.name}（点击切换）`}
            >
              <div className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0">
                <EngineIcon engineId={currentEngine.id} />
              </div>
            </button>

            {/* Engine dropdown menu (T11 & C009 & C011: 同质化毛玻璃外观 + 置顶 z-50 防遮挡 + 全域点击关闭) */}
            {showEngineMenu && (
              <div
                ref={menuRef}
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

          {/* Input box: T13 规范（光标与字体同色、对焦即隐占位）+ C014 规范（动态自适应字色与光标） */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true);
              if (query.trim()) {
                setShowSuggestions(true);
              }
              setShowEngineMenu(false);
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={isFocused ? '' : `在 ${currentEngine.name} 中搜索...`}
            title={`在 ${currentEngine.name} 中搜索（按 \` 对焦，按 Tab 切换引擎）`}
            style={{
              color: textColor,
              caretColor: textColor,
            }}
            className={`flex-1 bg-transparent py-3 pr-4 pl-1 text-sm focus:placeholder-transparent focus:outline-none transition-colors ${
              tone === 'light'
                ? 'placeholder:text-white/60'
                : 'placeholder:text-stone-500/70'
            }`}
          />

          {/* Tab switcher visual hint when idle */}
          {!query && (
            <span
              className="hidden sm:inline-flex items-center px-1.5 py-0.5 mr-2 rounded text-[10px] font-mono select-none pointer-events-none transition-colors"
              style={{
                color: tone === 'light' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(20, 28, 32, 0.6)',
                backgroundColor: tone === 'light' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.06)',
              }}
            >
              Tab 切擎
            </span>
          )}

          {/* Submit Search Button */}
          <button
            type="submit"
            className="pr-4 transition-colors"
            style={{
              color: tone === 'light' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(20, 28, 32, 0.55)',
            }}
            title="搜索"
          >
            <SearchIcon className="w-4 h-4" />
          </button>
        </form>

        {/* Search suggestions dropdown (T13 & C012: 毛玻璃同质化 + 实时联想 + 键盘导航，不记录历史) */}
        {showSuggestions && query.trim().length > 0 && suggestions.length > 0 && (
          <div
            className="origin-top absolute left-0 right-0 top-full mt-2 py-1.5 border border-black/10 dark:border-white/15 shadow-xl z-50 overflow-hidden"
            style={{
              backgroundColor: `rgba(255, 255, 255, ${opacity})`,
              backdropFilter: `blur(${blurPx}px)`,
              WebkitBackdropFilter: `blur(${blurPx}px)`,
              borderRadius: `${Math.min(appearance.radius ?? 24, 18)}px`,
            }}
          >
            {suggestions.map((item, index) => (
              <div
                key={`${item.text}-${index}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => handleSelectSuggestion(item.text)}
                className={`w-full px-3.5 py-2 text-left text-xs transition-colors flex items-center justify-between cursor-pointer group ${
                  index === selectedIndex
                    ? 'bg-black/10 dark:bg-white/15 text-stone-900 dark:text-white font-medium'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <SearchIcon className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                  <span className="truncate">{item.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
