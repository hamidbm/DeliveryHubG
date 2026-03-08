import type { ExplainabilityContent } from '../types';

export const EXPLAINABILITY_REGISTRY: Record<string, ExplainabilityContent> = {
  capacity_utilization: {
    id: 'capacity_utilization',
    title: 'Capacity Utilization',
    shortText: 'Shows how full the milestone is relative to its target capacity.',
    detailText: 'Utilization compares committed work to the milestone target capacity. Higher values indicate the milestone is overloaded.',
    whyItMatters: 'Overloaded milestones are more likely to slip and create downstream risk.',
    howToUse: 'If utilization is high, reduce scope or shift work to a later milestone.',
    actions: ['Reduce scope in the milestone', 'Shift items to a later milestone', 'Increase capacity if possible']
  },
  risk_level: {
    id: 'risk_level',
    title: 'Risk Level',
    shortText: 'Derived risk based on blocked work, dependencies, readiness, and capacity pressure.',
    detailText: 'Risk level combines multiple signals rather than relying on manual labels.',
    whyItMatters: 'High risk indicates likely delivery slippage without corrective action.',
    howToUse: 'Investigate blockers, dependencies, and readiness gaps.',
    actions: ['Resolve blockers', 'Reduce scope', 'Address readiness gaps']
  },
  readiness: {
    id: 'readiness',
    title: 'Readiness',
    shortText: 'Reflects planning completeness and execution preparedness.',
    detailText: 'Readiness is influenced by missing estimates, missing assignments, and incomplete planning data.',
    whyItMatters: 'Low readiness increases delivery uncertainty.',
    howToUse: 'Fill missing estimates, assign owners, and finalize scope.'
  },
  confidence: {
    id: 'confidence',
    title: 'Confidence',
    shortText: 'Overall confidence level based on risk and capacity signals.',
    detailText: 'Confidence drops as risk and capacity pressure rise.',
    whyItMatters: 'Low confidence is a warning for delivery risk.',
    howToUse: 'Reduce risk drivers or adjust schedule expectations.'
  },
  blocked_items: {
    id: 'blocked_items',
    title: 'Blocked Items',
    shortText: 'Count of work items blocked by dependencies.',
    detailText: 'Blocked items prevent progress and increase delay risk.',
    whyItMatters: 'Too many blocked items can stall milestone progress.',
    howToUse: 'Resolve blockers or re-sequence work.'
  },
  dependency_pressure: {
    id: 'dependency_pressure',
    title: 'Dependency Pressure',
    shortText: 'Inbound and outbound dependencies impacting the milestone.',
    detailText: 'More inbound dependencies means more external work must complete first.',
    whyItMatters: 'High dependency pressure raises uncertainty and delay risk.',
    howToUse: 'Coordinate with dependent teams and track blockers early.'
  },
  forecast_window: {
    id: 'forecast_window',
    title: 'Forecast Window',
    shortText: 'Best, expected, and worst-case delivery range.',
    detailText: 'Forecast windows reflect uncertainty driven by risk, readiness, and capacity signals.',
    whyItMatters: 'Helps teams anticipate potential delays earlier than schedule dates.',
    howToUse: 'Use the window to plan mitigation or adjust expectations.'
  },
  on_time_probability: {
    id: 'on_time_probability',
    title: 'On-Time Probability',
    shortText: 'Estimated likelihood of finishing on or before the planned end date.',
    detailText: 'Derived from milestone risk, dependencies, blocked work, and forecast spread.',
    whyItMatters: 'Low probability signals delivery risk even if dates look healthy.',
    howToUse: 'Focus on dependencies, scope, and capacity to raise probability.'
  },
  uncertainty_level: {
    id: 'uncertainty_level',
    title: 'Uncertainty Level',
    shortText: 'Indicates forecast spread and schedule uncertainty.',
    detailText: 'Higher uncertainty means a wider spread between likely and late outcomes.',
    whyItMatters: 'High uncertainty reduces schedule predictability.',
    howToUse: 'Reduce scope, stabilize dependencies, and improve readiness.'
  },
  p50_date: {
    id: 'p50_date',
    title: 'P50 Date',
    shortText: 'The midpoint likely completion date.',
    detailText: 'P50 represents the median forecast outcome.',
    whyItMatters: 'Useful for expected planning outcomes.',
    howToUse: 'Compare P50 to planned dates to judge likely slip.'
  },
  p90_date: {
    id: 'p90_date',
    title: 'P90 Date',
    shortText: 'A high-confidence completion date.',
    detailText: 'P90 is the date the milestone is expected to finish by in 90% of scenarios.',
    whyItMatters: 'Shows a conservative delivery bound.',
    howToUse: 'Use P90 for external commitments or risk buffers.'
  },
  simulation_scenario: {
    id: 'simulation_scenario',
    title: 'Simulation Scenario',
    shortText: 'What-if analysis that compares a baseline plan to changes.',
    detailText: 'Scenarios do not change the baseline plan; they help evaluate impact before committing.',
    whyItMatters: 'Lets teams evaluate changes without risk.',
    howToUse: 'Try capacity or scope changes and compare results.'
  },
  scenario_delta: {
    id: 'scenario_delta',
    title: 'Scenario Delta',
    shortText: 'Difference between baseline and scenario outcomes.',
    detailText: 'Shows how changes affect utilization, risk, and schedule.',
    whyItMatters: 'Highlights the impact of proposed changes.',
    howToUse: 'Use deltas to decide whether to commit changes.'
  },
  portfolio_health: {
    id: 'portfolio_health',
    title: 'Portfolio Health',
    shortText: 'Aggregated delivery health across multiple plans.',
    detailText: 'Summarizes risk and capacity pressure across plans.',
    whyItMatters: 'Helps leaders spot concentration of risk.',
    howToUse: 'Investigate plans with high-risk or overloaded milestones.'
  },
  high_risk_milestones: {
    id: 'high_risk_milestones',
    title: 'High Risk Milestones',
    shortText: 'Count of milestones classified as high risk.',
    detailText: 'High risk is derived from capacity pressure, blockers, dependencies, and readiness.',
    whyItMatters: 'Indicates where portfolio attention is needed.',
    howToUse: 'Review drivers in the highest-risk milestones.'
  },
  average_utilization: {
    id: 'average_utilization',
    title: 'Average Utilization',
    shortText: 'Average capacity utilization across milestones.',
    detailText: 'Shows how full the portfolio is relative to capacity.',
    whyItMatters: 'Sustained high utilization increases schedule risk.',
    howToUse: 'Balance scope and capacity across plans.'
  },
  expected_portfolio_slip: {
    id: 'expected_portfolio_slip',
    title: 'Expected Portfolio Slip',
    shortText: 'Average expected schedule slip across the portfolio.',
    detailText: 'Derived from plan forecasts and risk signals.',
    whyItMatters: 'Provides a macro view of schedule risk.',
    howToUse: 'Focus on plans with the largest expected slip.'
  }
};
