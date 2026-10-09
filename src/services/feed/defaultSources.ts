/**
 * 预置真实高质量开箱即用订阅源 (T18)
 * 拒绝假数据：默认提供真实稳定的技术与科技公开订阅流
 */

import { FeedSource } from './types';

export const DEFAULT_FEED_SOURCES: FeedSource[] = [
  {
    id: 'src-ruanyifeng',
    name: '阮一峰的网络日志',
    url: 'https://www.ruanyifeng.com/blog/atom.xml',
    type: 'atom',
    category: 'blog',
    categoryName: '博客',
    enabled: true,
    refreshIntervalMinutes: 60,
  },
  {
    id: 'src-sspai',
    name: '少数派 (SSPAI)',
    url: 'https://sspai.com/feed',
    type: 'rss',
    category: 'tech',
    categoryName: '科技',
    enabled: true,
    refreshIntervalMinutes: 30,
  },
  {
    id: 'src-v2ex',
    name: 'V2EX 热门',
    url: 'https://www.v2ex.com/index.xml',
    type: 'rss',
    category: 'tech',
    categoryName: '极客',
    enabled: true,
    refreshIntervalMinutes: 30,
  },
  {
    id: 'src-github-trending-script',
    name: 'GitHub 热门 TS 项目 (脚本源)',
    url: 'https://api.github.com/search/repositories?q=stars:>20000+language:typescript&sort=stars&order=desc',
    type: 'script',
    category: 'github',
    categoryName: 'GitHub',
    enabled: true,
    refreshIntervalMinutes: 120,
    scriptConfig: {
      transformScript: `// 极客脚本源演示：解析 GitHub Search API 并映射为标准订阅流
return (data.items || []).slice(0, 8).map(repo => ({
  id: String(repo.id),
  title: repo.full_name + ' ★ ' + repo.stargazers_count.toLocaleString(),
  link: repo.html_url,
  summary: repo.description || '暂无描述',
  pubDate: repo.pushed_at || repo.updated_at
}));`,
    },
  },
];
