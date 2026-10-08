import React, { useState, useEffect, useRef } from 'react';
import { WidgetComponentProps, WidgetManifest } from '../../contract/types';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export const todoManifest: WidgetManifest = {
  typeId: 'core.todo',
  contractVersion: 1,
  contentVersion: 1,
  displayName: '今日待办',
  icon: 'CheckSquare',
  defaultSpan: 6,
  supportedSpans: [4, 6, 8, 12],
  minContentHeight: 180,
  capabilities: {
    storage: true,
  },
  syncPolicy: 'optIn',
};

export const TodoWidget: React.FC<WidgetComponentProps> = ({ host }) => {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loaded, setLoaded] = useState(false);
  const isFirstRender = useRef(true);

  // Load content on mount
  useEffect(() => {
    let active = true;
    host.storage.getContent<TodoItem[]>([]).then((saved) => {
      if (active) {
        setItems(Array.isArray(saved) ? saved : []);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [host.instanceId]);

  // Save content whenever items change (after initial load)
  useEffect(() => {
    if (isFirstRender.current) {
      if (loaded) {
        isFirstRender.current = false;
      }
      return;
    }
    host.storage.setContent<TodoItem[]>(items);
  }, [items, loaded, host.instanceId]);

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    const newItem: TodoItem = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      completed: false,
      createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
    setInputValue('');
  };

  const toggleComplete = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCompleted = () => {
    setItems((prev) => prev.filter((item) => !item.completed));
  };

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Input row */}
      <form onSubmit={handleAdd} className="flex items-center space-x-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="添加今日待办事项..."
          className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-hidden focus:border-stone-400 dark:focus:border-stone-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="p-1.5 rounded-xl bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
          title="添加"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Progress & batch action */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 px-0.5">
          <div className="flex items-center space-x-2 flex-1 mr-4">
            <span>
              已完成 {completedCount}/{totalCount}
            </span>
            <div className="flex-1 max-w-[120px] h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          {completedCount > 0 && (
            <button
              onClick={handleClearCompleted}
              className="text-stone-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              清除已完成
            </button>
          )}
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 max-h-56 overflow-y-auto space-y-1.5 pr-1">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-stone-400 dark:text-stone-500">
            <CheckCircle2 className="w-7 h-7 mb-2 opacity-30 stroke-[1.5]" />
            <span className="text-xs">暂无待办事项，开始规划今天吧</span>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center justify-between p-2 rounded-xl border transition-all ${
                item.completed
                  ? 'bg-black/[0.02] dark:bg-white/[0.02] border-transparent opacity-60'
                  : 'bg-white/60 dark:bg-stone-800/40 border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10'
              }`}
            >
              <div
                onClick={() => toggleComplete(item.id)}
                className="flex items-center space-x-2.5 flex-1 cursor-pointer overflow-hidden select-none"
              >
                {item.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 shrink-0" />
                )}
                <span
                  className={`text-xs truncate ${
                    item.completed
                      ? 'line-through text-stone-400 dark:text-stone-500'
                      : 'text-stone-800 dark:text-stone-200'
                  }`}
                >
                  {item.text}
                </span>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-rose-500 transition-opacity rounded-lg"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
