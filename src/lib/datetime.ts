/**
 * 统一时间格式化（阶段3 收尾 / L8）。
 *
 * 之前各页面统一用 toLocaleDateString('en-US')，在中文界面下与其余文案不一致。
 * 这里跟随运行环境的语言，并统一"年月日 + 时分"的表达。
 */

const DATE_TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function getFormatter(locale: string): Intl.DateTimeFormat {
  const cached = DATE_TIME_FORMATTERS.get(locale)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  DATE_TIME_FORMATTERS.set(locale, formatter)
  return formatter
}

/** 运行环境语言；SSR / 非浏览器环境回落到 zh-CN */
function getLocale(): string {
  if (typeof navigator === 'undefined') return 'zh-CN'
  return navigator.language || 'zh-CN'
}

/**
 * 格式化为「2026-10-27 23:04」。
 * 传入非法时间时返回 '-'，避免在列表里渲染出 Invalid Date。
 */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return getFormatter(getLocale()).format(date).replace(/\//g, '-')
}

/** 只保留日期部分：「2026-10-27」 */
export function formatDate(value: string | number | Date | null | undefined): string {
  const formatted = formatDateTime(value)
  if (formatted === '-') return '-'
  // noUncheckedIndexedAccess 下索引可能是 undefined，取不到时退回完整值
  return formatted.split(' ')[0] ?? formatted
}

/**
 * 相对时间（如"3 分钟前"），用于"最近修改"这类需要直觉判断的列。
 * 超过 30 天改用绝对日期，避免"243 天前"这种无信息量的文案。
 */
export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const diffMs = Date.now() - date.getTime()
  const absMs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })

  if (absMs < minute) return rtf.format(0, 'second')
  if (absMs < hour) return rtf.format(-Math.round(diffMs / minute), 'minute')
  if (absMs < day) return rtf.format(-Math.round(diffMs / hour), 'hour')
  if (absMs < 30 * day) return rtf.format(-Math.round(diffMs / day), 'day')

  return formatDateTime(date)
}
