import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { titleCase } from '../lib/utils';

export const CHART_COLORS = ['#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#10b981', '#64748b'];

const axisProps = {
  tick: { fontSize: 11, fill: '#94a3b8' },
  axisLine: false,
  tickLine: false,
};

function ChartTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey || item.name} className="text-slate-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
          {titleCase(item.name)}: <span className="font-semibold text-slate-700">{valueFormatter ? valueFormatter(item.value) : item.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartCard({ title, description, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function AreaTrendChart({ data, dataKey = 'value', color = '#0d9488', valueFormatter, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#gradient-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLineChart({ data, series, valueFormatter, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((item) => (
          <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={2.5} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarDistribution({ data, dataKey = 'value', color = '#0d9488', valueFormatter, height = 280, horizontal = false }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 5, right: 10, left: horizontal ? 20 : -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axisProps} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={90} {...axisProps} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
          </>
        )}
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, valueFormatter, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => (valueFormatter ? valueFormatter(value) : value)} />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => titleCase(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
