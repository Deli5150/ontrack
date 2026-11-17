// What's New in each version (newest first). CHANGELOG.md carries the same notes for GitHub Releases.

export const CHANGELOG: Array<{ version: string; date: string; items: string[] }> = [
  {
    version: '1.0.1',
    date: '2026-11-16',
    items: [
      'Import from photos finds every subscription in a screenshot of a list, not just one',
      'Import a file reads spreadsheets of subscriptions, bills or debts (CSV or Excel), one per row, with the right categories',
      'Receipts use the plan’s price, not the tax, total or a date',
      'Calendar: swipe anywhere on the screen to change month'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-11-14',
    items: [
      'Track every subscription with its price, cycle, payment date, free trial, list, category and payment method',
      'Spending ring: one slice per active subscription, sized by what it costs',
      '8 colour themes, built-in wallpapers or your own photo',
      'A desktop layout with a sidebar and side-by-side panes',
      'Calendar of payments with monthly total and what’s still to come',
      'Add from 120+ popular services, type or paste (“Netflix 15.99 monthly”), or import screenshots and bank statements',
      'Official brand logos from SVGL, or pick an icon, an emoji or your own picture',
      'Reminders before payments, billing and price history, any currency with live exchange rates',
      'Export and import your data, and in-app updates on every platform',
      'iPhone updates through AltStore, SideStore, Feather or FlareStore',
      'Report a bug or request a feature from Settings'
    ]
  }
]
