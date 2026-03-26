import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, BarChart2, RefreshCw } from 'lucide-react'
import { useSyllabus } from '../../context/SyllabusContext'

export default function GapAnalysisPanel({ classroomId }) {
  const { gapData, fetchGapAnalysis } = useSyllabus()

  useEffect(() => {
    if (classroomId) fetchGapAnalysis(classroomId)
  }, [classroomId, fetchGapAnalysis])

  if (!gapData) return (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Analyzing…
    </div>
  )

  const { gap_nodes, total_nodes, covered_nodes, gap_count, coverage_percent } = gapData

  const progressColor = coverage_percent >= 80
    ? 'bg-emerald-500'
    : coverage_percent >= 50
    ? 'bg-amber-500'
    : 'bg-red-500'

  const byType = gap_nodes.reduce((acc, n) => {
    ;(acc[n.node_type] = acc[n.node_type] || []).push(n)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Coverage Overview</h3>
        </div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-3xl font-bold text-white">{coverage_percent}%</span>
          <span className="text-xs text-slate-500">{covered_nodes}/{total_nodes} nodes covered</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
            style={{ width: `${coverage_percent}%` }}
          />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Covered: {covered_nodes}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Missing: {gap_count}
          </span>
        </div>
      </div>

      {/* Gap nodes */}
      {gap_count === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-white font-medium">All topics covered!</p>
          <p className="text-slate-500 text-sm mt-1">Every syllabus node has at least one resource.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            Topics Missing Resources ({gap_count})
          </h4>
          {Object.entries(byType).map(([type, nodes]) => (
            <div key={type}>
              <p className="text-xs text-slate-500 capitalize mb-1.5 font-medium">{type}s</p>
              <ul className="space-y-1.5">
                {nodes.map(n => (
                  <li key={n.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-600/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-sm text-slate-300 truncate">{n.title}</span>
                    <span className="ml-auto text-xs text-red-400 flex-shrink-0">No resources</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
