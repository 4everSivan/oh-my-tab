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
  { id: 'google', name: 'Google', url: 'https://www.google.com/search', queryParam: 'q' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search', queryParam: 'q' },
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s', queryParam: 'wd' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/', queryParam: 'q' },
];

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
      className={`w-full flex ${alignClass}`}
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
            className="flex items-center space-x-1 pl-4 pr-2 py-3 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors select-none text-xs font-medium"
            title="切换搜索引擎"
          >
            <span>{currentEngine.name}</span>
          </button>

          {/* Engine dropdown menu */}
          {showEngineMenu && (
            <div className="origin-menu absolute left-0 mt-2 w-32 py-1.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl border border-black/10 dark:border-white/10 shadow-lg z-30">
              {SEARCH_ENGINES.map((engine) => (
                <button
                  key={engine.id}
                  type="button"
                  onClick={() => {
                    onEngineChange(engine.id);
                    setShowEngineMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                    engine.id === currentEngine.id
                      ? 'text-stone-900 dark:text-white font-medium bg-black/5 dark:bg-white/10'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span>{engine.name}</span>
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
