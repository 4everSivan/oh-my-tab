/**
 * 订阅源与订阅流条目类型定义 (T18 - ExtensionDataSources)
 */

export type FeedSourceType = 'rss' | 'atom' | 'json' | 'script';

export interface ScriptConfig {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  // 转换函数源码，入参为 (data, text, url)，返回 ParsedFeedItem[]
  transformScript: string;
}

export interface FeedSource {
  id: string;                      // 唯一标识 (如 'src-ruanyifeng')
  name: string;                    // 订阅源显示名称 (如 '阮一峰的网络日志')
  url: string;                     // 订阅源请求 URL
  type: FeedSourceType;            // 订阅类型
  category: string;                // 分类 (如 'tech' | 'blog' | 'news' | 'github' 等)
  categoryName: string;            // 分类中文名
  enabled: boolean;                // 是否启用
  refreshIntervalMinutes?: number; // 刷新间隔 (分钟，默认 30)
  lastFetchedAt?: number;          // 上次抓取时间戳
  lastError?: string;              // 上次抓取错误详情 (若有)
  itemCount?: number;              // 抓取到的条目数量
  scriptConfig?: ScriptConfig;     // 脚本源专属配置
}

export interface ParsedFeedItem {
  id?: string;
  title: string;
  link: string;
  pubDate?: string | number | Date;
  summary?: string;
  author?: string;
}

export interface FeedItem {
  id: string;                      // 条目全局唯一 ID (hash/guid)
  sourceId: string;                // 所属源 ID
  sourceTitle: string;             // 所属源名称
  category: string;                // 类别标识
  categoryName: string;            // 类别名称
  tagClass?: string;               // 标签样式名
  title: string;                   // 文章标题
  time: string;                    // 人性化相对时间 (如 "10分钟前", "昨天")
  timestamp: number;               // 发布毫秒时间戳 (用于时间排序)
  summary: string;                 // 纯文本清洗后摘要 (至多 150 字)
  url: string;                     // 原文直达地址
  read: boolean;                   // 是否已读
}

export interface OpmlOutline {
  text: string;
  title?: string;
  xmlUrl: string;
  htmlUrl?: string;
  type?: string;
  category?: string;
}
