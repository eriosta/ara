import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from 'react-joyride'

export const DASHBOARD_STEPS: Step[] = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: 'Navigation',
    content: 'Switch between the Dashboard overview and the detailed Study Breakdown table.',
    disableBeacon: true,
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-upload"]',
    title: 'Upload Data',
    content: 'Upload your RVU data files here. Supports CSV and Excel formats from your PACS/RIS system.',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-export"]',
    title: 'Export Reports',
    content: 'Export your data as a PDF summary report or download the raw CSV for further analysis.',
    placement: 'right',
  },
  {
    target: '[data-tour="toolbar-goal"]',
    title: 'Daily RVU Goal',
    content: 'Set your daily RVU target. We\'ll suggest goals based on your historical data and show how you\'re tracking.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="toolbar-filters"]',
    title: 'Filters',
    content: 'Filter your entire dashboard by date range, time of day, modality, or body part.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="metrics-overview"]',
    title: 'Key Metrics',
    content: 'Your performance at a glance — daily RVUs, efficiency, volume, and complexity. Hover the (i) icons for explanations.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="chart-daily"]',
    title: 'Daily Trend',
    content: 'Track your daily RVU output over time with a 7-day moving average. The red line shows your goal.',
    placement: 'top',
  },
  {
    target: '[data-tour="section-patterns"]',
    title: 'Work Patterns',
    content: 'Discover which hours and days of the week you\'re most productive. Use this to optimize your schedule.',
    placement: 'top',
  },
  {
    target: '[data-tour="section-case-analysis"]',
    title: 'Case Analysis',
    content: 'See your top case types and modality distribution. Understand where your RVUs are coming from.',
    placement: 'top',
  },
]

export const BREAKDOWN_STEPS: Step[] = [
  {
    target: '[data-tour="breakdown-search"]',
    title: 'Search Studies',
    content: 'Search across all your studies by exam description, modality, or body part.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[data-tour="breakdown-filters"]',
    title: 'Filter by Category',
    content: 'Filter studies by modality (CT, MRI, US, etc.) and body part. Color-coded chips show active filters.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="breakdown-stats"]',
    title: 'Live Stats',
    content: 'Total study count and RVUs update in real-time as you filter. Quickly see the impact of each filter.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="breakdown-tree"]',
    title: 'Study Tree',
    content: 'Studies are organized by Modality > Body Part > Individual Study. Click any row to expand and drill down.',
    placement: 'top',
  },
]

function CustomTooltip({
  continuous,
  index,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="rounded-xl p-5 max-w-xs"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {step.title && (
        <h4 className="text-sm font-display font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
          {step.title as string}
        </h4>
      )}
      <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
        {step.content as string}
      </p>
      <div className="flex items-center justify-between">
        <button
          {...skipProps}
          className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {index + 1}/{step.data?.totalSteps ?? '?'}
          </span>
          {index > 0 && (
            <button
              {...backProps}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
            >
              Back
            </button>
          )}
          {continuous && (
            <button
              {...primaryProps}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {isLastStep ? 'Done' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface ProductTourProps {
  run: boolean
  onClose: () => void
  steps: Step[]
}

export default function ProductTour({ run, onClose, steps }: ProductTourProps) {
  const handleCallback = (data: CallBackProps) => {
    const { status } = data
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onClose()
    }
  }

  // Inject totalSteps into each step's data for the counter
  const stepsWithCount = steps.map(s => ({
    ...s,
    data: { ...s.data, totalSteps: steps.length },
  }))

  return (
    <Joyride
      steps={stepsWithCount}
      run={run}
      continuous
      showSkipButton
      scrollToFirstStep
      disableOverlayClose
      disableScrollParentFix
      callback={handleCallback}
      tooltipComponent={CustomTooltip}
      floaterProps={{
        styles: {
          floater: { filter: 'none' },
        },
      }}
      styles={{
        options: {
          zIndex: 10000,
          overlayColor: 'rgba(0, 0, 0, 0.7)',
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  )
}
