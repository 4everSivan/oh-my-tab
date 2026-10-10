import React, { useState, useRef } from 'react';
import {
  X,
  Bell,
  Check,
  ExternalLink,
  PlusCircle,
  Inbox,
  RefreshCw,
  Settings,
  ArrowLeft,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  AlertCircle,
  Code2,
  Rss,
  CheckCircle2,
} from 'lucide-react';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';
import { FeedItem as BaseFeedItem, FeedSource, FeedSourceType } from '../../services/feed/types';
import { feedService } from '../../services/feed/feedService';

export interface FeedItem extends BaseFeedItem {}
export type { FeedSource };

export interface FeedSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  feeds: FeedItem[];
  sources?: FeedSource[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onToggleRead: (id: string) => void;
  onMarkAllRead: () => void;
  onAddSource?: (source: Omit<FeedSource, 'id'>) => Promise<void>;
  onToggleSource?: (id: string, enabled: boolean) => Promise<void>;
  onDeleteSource?: (id: string) => Promise<void>;
  onResetDefaultSources?: () => Promise<void>;
  onImportOpml?: (xmlText: string) => Promise<number>;
  onExportOpml?: () => Promise<void>;
}

export const FeedSidebar: React.FC<FeedSidebarProps> = ({
  isOpen,
  onClose,
  feeds,
  sources = [],
  isRefreshing = false,
  onRefresh,
  onToggleRead,
  onMarkAllRead,
  onAddSource,
  onToggleSource,
  onDeleteSource,
  onResetDefaultSources,
  onImportOpml,
  onExportOpml,
}) => {
  const [currentView, setCurrentView] = useState<'timeline' | 'sources'>('timeline');
  const [feedCategory, setFeedCategory] = useState<string>('all');
  const [isAddingSource, setIsAddingSource] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 新建订阅源表单状态
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<FeedSourceType>('rss');
  const [newCategory, setNewCategory] = useState('tech');
  const [newScript, setNewScript] = useState(`// 极客脚本源：接收 data (JSON/对象) 或 rawText，返回条目数组\nreturn (data.items || data || []).slice(0, 10).map(item => ({\n  title: item.title || item.name,\n  link: item.url || item.html_url,\n  summary: item.summary || item.description,\n  pubDate: item.date || item.created_at\n}));`);
  const [testResult, setTestResult] = useState<{ testing: boolean; message?: string; success?: boolean }>({
    testing: false,
  });

  const { mounted, open } = useDelayedUnmount(isOpen, 350);

  if (!mounted) return null;

  const unreadCount = feeds.filter((f) => !f.read).length;

  // 动态生成分类过滤项
  const categorySet = new Set<string>();
  feeds.forEach((f) => {
    if (f.category) categorySet.add(f.category);
  });
  const categories = [
    { id: 'all', name: `全部 (${feeds.length})` },
    ...Array.from(categorySet).map((cat) => {
      const matched = feeds.find((f) => f.category === cat);
      return { id: cat, name: matched?.categoryName || cat };
    }),
  ];

  const filteredFeeds = feeds.filter(
    (f) => feedCategory === 'all' || f.category === feedCategory
  );

  const getTagStyle = (tagClass?: string) => {
    switch (tagClass) {
      case 'github':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/40';
      case 'news':
      case 'tech':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
      case 'blog':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/40';
      case 'todo':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';
      default:
        return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700';
    }
  };

  const handleCardClick = (feed: FeedItem) => {
    onToggleRead(feed.id);
    if (feed.url && feed.url !== '#') {
      window.open(feed.url, '_blank');
    }
  };

  // 测试源连通性
  const handleTestSource = async () => {
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      setTestResult({ testing: false, success: false, message: '请先填写订阅 URL 地址' });
      return;
    }

    setTestResult({ testing: true });
    try {
      const tempSource: FeedSource = {
        id: 'temp-test',
        name: newName || '测试源',
        url: trimmedUrl,
        type: newType,
        category: newCategory,
        categoryName: newCategory,
        enabled: true,
        scriptConfig: newType === 'script' ? { transformScript: newScript } : undefined,
      };

      const parsed = await feedService.fetchSingleSource(tempSource);
      setTestResult({
        testing: false,
        success: true,
        message: `测试成功！成功提取到 ${parsed.length} 条文章 (首条: ${parsed[0]?.title || '无标题'})`,
      });
    } catch (err: any) {
      setTestResult({
        testing: false,
        success: false,
        message: `测试失败: ${err?.message || String(err)}`,
      });
    }
  };

  // 提交新建源
  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('请输入订阅源名称');
      return;
    }
    if (!newUrl.trim()) {
      alert('请输入订阅源地址');
      return;
    }

    if (onAddSource) {
      await onAddSource({
        name: newName.trim(),
        url: newUrl.trim(),
        type: newType,
        category: newCategory,
        categoryName: newCategory === 'blog' ? '博客' : newCategory === 'tech' ? '科技' : newCategory === 'github' ? 'GitHub' : '资讯',
        enabled: true,
        refreshIntervalMinutes: 30,
        scriptConfig: newType === 'script' ? { transformScript: newScript } : undefined,
      });
    }

    // 重置表单
    setNewName('');
    setNewUrl('');
    setTestResult({ testing: false });
    setIsAddingSource(false);
  };

  // OPML 导入处理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text === 'string' && onImportOpml) {
        try {
          const added = await onImportOpml(text);
          alert(`成功导入 ${added} 个订阅源！`);
        } catch (err: any) {
          alert(`导入 OPML 失败: ${err?.message || String(err)}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      data-open={open}
      onClick={onClose}
      className="t-panel-overlay fixed inset-0 z-50 flex justify-end p-3 sm:p-4 bg-black/25 dark:bg-black/40 backdrop-blur-xs overflow-hidden"
    >
      <div
        data-open={open}
        onClick={(e) => e.stopPropagation()}
        className="t-panel-slide w-full max-w-[440px] h-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center space-x-2.5">
            {currentView === 'sources' ? (
              <button
                onClick={() => {
                  setCurrentView('timeline');
                  setIsAddingSource(false);
                }}
                className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-stone-600 dark:text-stone-300 hover:bg-black/10 dark:hover:bg-white/20 transition-colors cursor-pointer mr-0.5"
                title="返回消息流"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-stone-800 dark:text-stone-200">
                <Bell className="w-4 h-4" />
              </div>
            )}

            <div>
              <div className="flex items-center space-x-1.5">
                <h2 className="text-sm font-semibold text-stone-800 dark:text-white tracking-wide">
                  {currentView === 'sources' ? '订阅源管理' : '订阅消息'}
                </h2>
                {currentView === 'timeline' && unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-rose-500 text-white animate-pulse shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {currentView === 'sources' ? '管理 RSS 与自定义脚本订阅源' : '全网资讯聚合 · 即时追踪动态'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {currentView === 'timeline' ? (
              <>
                {/* 刷新按钮 */}
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    title="刷新全部订阅"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
                  </button>
                )}
                {/* 进入源管理按钮 */}
                <button
                  onClick={() => setCurrentView('sources')}
                  className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="订阅源管理与 OPML 导入"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsAddingSource((prev) => !prev)}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg font-medium bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isAddingSource ? '关闭添加' : '添加源'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="关闭订阅栏 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 视图一：消息流 (Timeline) */}
        {currentView === 'timeline' && (
          <>
            {/* Toolbar: Category Chips & Mark All Read */}
            <div className="px-5 py-3 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
              {/* Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[280px]">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFeedCategory(cat.id)}
                    className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all cursor-pointer whitespace-nowrap ${
                      feedCategory === cat.id
                        ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                        : 'bg-black/5 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-black/10 dark:hover:bg-white/10'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Mark All Read */}
              <button
                onClick={onMarkAllRead}
                disabled={unreadCount === 0}
                className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  unreadCount > 0
                    ? 'text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer active:scale-95'
                    : 'text-stone-300 dark:text-stone-600 cursor-not-allowed opacity-60'
                }`}
                title="全部标为已读"
              >
                <Check className="w-3.5 h-3.5" />
                <span>全部已读</span>
              </button>
            </div>

            {/* Feeds List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isRefreshing && filteredFeeds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-stone-400">
                  <RefreshCw className="w-8 h-8 mb-3 animate-spin text-stone-400 stroke-[1.5]" />
                  <p className="text-xs font-medium">正在拉取最新订阅内容…</p>
                </div>
              ) : filteredFeeds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400 dark:text-stone-500">
                  <Inbox className="w-10 h-10 mb-2 opacity-50 stroke-[1.5]" />
                  <p className="text-xs font-medium">暂无此类订阅消息</p>
                  <button
                    onClick={() => setCurrentView('sources')}
                    className="mt-4 px-3 py-1.5 text-xs rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                  >
                    前往管理或添加订阅源
                  </button>
                </div>
              ) : (
                filteredFeeds.map((feed) => (
                  <article
                    key={feed.id}
                    onClick={() => handleCardClick(feed)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                      feed.read
                        ? 'bg-black/[0.015] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-70 hover:opacity-100 hover:border-black/10 dark:hover:border-white/15'
                        : 'bg-white dark:bg-stone-800/90 border-black/10 dark:border-white/10 shadow-xs hover:shadow-md hover:border-black/20 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getTagStyle(
                            feed.tagClass
                          )}`}
                        >
                          {feed.sourceTitle || feed.categoryName}
                        </span>
                        {!feed.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400 dark:text-stone-500 whitespace-nowrap">
                        {feed.time}
                      </span>
                    </div>

                    <h3
                      className={`text-xs font-medium leading-relaxed group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center justify-between gap-1.5 ${
                        feed.read
                          ? 'text-stone-600 dark:text-stone-400'
                          : 'text-stone-900 dark:text-white font-semibold'
                      }`}
                    >
                      <span className="line-clamp-2">{feed.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-stone-400" />
                    </h3>

                    {feed.summary && (
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                        {feed.summary}
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
          </>
        )}

        {/* 视图二：源管理 (Source Manager) */}
        {currentView === 'sources' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* OPML 导入隐藏 Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".opml,.xml"
              className="hidden"
            />

            {/* 新建源表单抽屉 */}
            {isAddingSource && (
              <form
                onSubmit={handleSaveSource}
                className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    新增自定义订阅源
                  </h3>
                  <span className="text-[10px] text-stone-400">支持 RSS 2.0 / Atom / 脚本</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                    订阅源类型
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewType('rss')}
                      className={`flex items-center justify-center space-x-1.5 py-1.5 text-xs rounded-lg border font-medium cursor-pointer transition-all ${
                        newType !== 'script'
                          ? 'bg-white dark:bg-stone-800 border-black/20 dark:border-white/20 shadow-xs text-stone-900 dark:text-white'
                          : 'border-transparent text-stone-500 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <Rss className="w-3.5 h-3.5 text-amber-500" />
                      <span>标准 RSS / Atom</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('script')}
                      className={`flex items-center justify-center space-x-1.5 py-1.5 text-xs rounded-lg border font-medium cursor-pointer transition-all ${
                        newType === 'script'
                          ? 'bg-white dark:bg-stone-800 border-black/20 dark:border-white/20 shadow-xs text-stone-900 dark:text-white'
                          : 'border-transparent text-stone-500 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5 text-purple-500" />
                      <span>极客脚本源</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                    源名称
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="如：阮一峰网络日志"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                    URL 地址
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={newType === 'script' ? '如：https://api.github.com/...' : '如：https://sspai.com/feed'}
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                    所属分类
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  >
                    <option value="tech">科技</option>
                    <option value="blog">博客</option>
                    <option value="github">GitHub</option>
                    <option value="news">资讯</option>
                    <option value="other">综合</option>
                  </select>
                </div>

                {newType === 'script' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-stone-600 dark:text-stone-400 flex items-center justify-between">
                      <span>转换脚本 (JavaScript)</span>
                      <span className="text-[10px] text-stone-400">支持 return Array</span>
                    </label>
                    <textarea
                      rows={5}
                      value={newScript}
                      onChange={(e) => setNewScript(e.target.value)}
                      className="w-full p-2.5 text-[11px] font-mono rounded-lg border border-black/10 dark:border-white/10 bg-stone-900 text-stone-100 dark:bg-black/80 focus:outline-none focus:ring-1 focus:ring-stone-400 leading-relaxed"
                    />
                  </div>
                )}

                {/* 测试结果提示 */}
                {testResult.message && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] flex items-start space-x-1.5 ${
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="leading-snug">{testResult.message}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleTestSource}
                    disabled={testResult.testing}
                    className="px-3 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-stone-700 dark:text-stone-300 font-medium transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    {testResult.testing && <RefreshCw className="w-3 h-3 animate-spin mr-1" />}
                    <span>{testResult.testing ? '正在测试…' : '测试连通'}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSource(false)}
                      className="px-3 py-1.5 text-xs rounded-lg text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900 font-medium shadow-xs cursor-pointer active:scale-95"
                    >
                      保存订阅
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* OPML 导入导出与重置栏 */}
            <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex-wrap">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="导入 .opml 文件"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-500" />
                  <span>导入 OPML</span>
                </button>
                {onExportOpml && (
                  <button
                    onClick={onExportOpml}
                    className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    title="导出当前订阅为 OPML"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-500" />
                    <span>导出 OPML</span>
                  </button>
                )}
              </div>

              {onResetDefaultSources && (
                <button
                  onClick={onResetDefaultSources}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  title="重置为官方精选源"
                >
                  <RotateCcw className="w-3 h-3 text-stone-400" />
                  <span>重置推荐</span>
                </button>
              )}
            </div>

            {/* 已订阅源列表 */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-1">
                已启用订阅 ({sources.filter((s) => s.enabled).length} / {sources.length})
              </div>

              {sources.map((source) => (
                <div
                  key={source.id}
                  className="p-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-stone-800/80 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                        {source.name}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded font-mono uppercase bg-black/5 dark:bg-white/10 text-stone-500 dark:text-stone-400">
                        {source.type}
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-400 truncate mt-0.5" title={source.url}>
                      {source.url}
                    </div>

                    {source.lastError ? (
                      <div className="text-[10px] text-rose-500 truncate mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span>抓取异常: {source.lastError}</span>
                      </div>
                    ) : (
                      source.itemCount !== undefined && (
                        <div className="text-[10px] text-stone-400 mt-0.5">
                          已缓存 {source.itemCount} 篇文章
                        </div>
                      )
                    )}
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {/* 启停开关 */}
                    {onToggleSource && (
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={(e) => onToggleSource(source.id, e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                        title={source.enabled ? '停用此源' : '启用此源'}
                      />
                    )}

                    {/* 删除按钮 */}
                    {onDeleteSource && (
                      <button
                        onClick={() => {
                          if (confirm(`确定要移除订阅源「${source.name}」吗？`)) {
                            onDeleteSource(source.id);
                          }
                        }}
                        className="p-1 rounded text-stone-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="删除订阅源"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
