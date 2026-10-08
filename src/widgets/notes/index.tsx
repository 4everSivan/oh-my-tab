import React, { useState, useEffect, useRef } from 'react';
import { WidgetComponentProps, WidgetManifest } from '../../contract/types';

export interface NotesContent {
  text: string;
  updatedAt?: number;
}

export const notesManifest: WidgetManifest = {
  typeId: 'core.notes',
  contractVersion: 1,
  contentVersion: 1,
  displayName: '随手便签',
  icon: 'FileText',
  defaultSpan: 6,
  supportedSpans: [4, 6, 8, 12],
  minContentHeight: 180,
  capabilities: {
    storage: true,
  },
  syncPolicy: 'optIn',
};

export const NotesWidget: React.FC<WidgetComponentProps> = ({ host }) => {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);

  // Load content on mount
  useEffect(() => {
    let active = true;
    host.storage.getContent<NotesContent>({ text: '' }).then((content) => {
      if (active) {
        setText(content?.text || '');
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [host.instanceId]);

  // Debounced auto-save
  useEffect(() => {
    if (!loaded) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    setSaveStatus('saving');
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      host.storage
        .setContent<NotesContent>({
          text,
          updatedAt: Date.now(),
        })
        .then(() => {
          setSaveStatus('saved');
        });
    }, 400);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [text, loaded, host.instanceId]);

  const handleBlur = () => {
    if (!loaded) return;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setSaveStatus('saving');
    host.storage
      .setContent<NotesContent>({
        text,
        updatedAt: Date.now(),
      })
      .then(() => {
        setSaveStatus('saved');
      });
  };

  const charCount = text.length;

  return (
    <div className="flex flex-col h-full space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="随时写下灵感、备忘、备用代码或待办清单..."
        className="w-full flex-1 min-h-[140px] p-3 text-xs leading-relaxed rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-hidden focus:border-stone-400 dark:focus:border-stone-500 transition-colors resize-none font-sans"
      />
      <div className="flex items-center justify-between text-[11px] text-stone-400 px-1 select-none">
        <span className="flex items-center space-x-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span>{saveStatus === 'saved' ? '已自动保存' : '正在保存...'}</span>
        </span>
        <span>{charCount} 字</span>
      </div>
    </div>
  );
};
