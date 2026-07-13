import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
        <p className="font-semibold text-neutral-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Coming soon</p>
      </div>
    </div>
  )
}
