export type IconName =
  | 'today'
  | 'tasks'
  | 'mail'
  | 'news'
  | 'habits'
  | 'plus'
  | 'check'
  | 'repeat'
  | 'pencil'
  | 'trash'
  | 'logout'
  | 'alert'
  | 'help'
  | 'lists'

const PATHS: Record<IconName, string[]> = {
  today: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm9 16 2 2 4-4'],
  tasks: ['M9 6h12', 'M9 12h12', 'M9 18h12', 'm3 6 1.5 1.5L7 5', 'm3 12 1.5 1.5L7 11', 'm3 18 1.5 1.5L7 17'],
  mail: ['M3 5h18v14H3z', 'm3 7 9 6 9-6'],
  news: ['M4 5h12v14H4z', 'M16 9h4v8a2 2 0 0 1-4 0z', 'M7 9h6', 'M7 13h6', 'M7 16h4'],
  habits: ['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 4v4h-4', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 20v-4h4'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['m5 13 4 4L19 7'],
  repeat: ['M4 10a6 6 0 0 1 6-6h7l-3-3', 'M20 14a6 6 0 0 1-6 6H7l3 3'],
  pencil: ['M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z', 'm14 6 4 4'],
  trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  logout: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'm10 8-4 4 4 4', 'M6 12h10'],
  alert: ['M12 3 2 20h20z', 'M12 9v5', 'M12 17h.01'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9.5 9a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2-2.5 3.5', 'M12 17h.01'],
  lists: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
}

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
