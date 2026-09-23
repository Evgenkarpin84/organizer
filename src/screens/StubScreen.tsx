import { Icon, type IconName } from '../components/Icon'

export function StubScreen({
  title,
  stage,
  description,
  icon,
}: {
  title: string
  stage: number
  description: string
  icon: IconName
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <Icon name={icon} className="h-12 w-12 text-slate-300" />
      <h2 className="text-base font-semibold text-slate-700">{title}</h2>
      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600">Этап {stage}</span>
      <p className="max-w-xs text-sm text-slate-500">{description}</p>
    </div>
  )
}
