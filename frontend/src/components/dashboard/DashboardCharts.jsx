import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { COR_SERIE_1, COR_SERIE_2, formatCurrency, formatCurrencyCurto, formatNumber } from './dashboardUtils.js';

// Gráficos do painel (recharts). Cores de texto/grade vêm das variáveis do
// tema, então funcionam no claro e no escuro. Sempre com dados reais.

const TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };
const GRID = 'hsl(var(--border))';

const TooltipBox = ({ active, payload, label, valueFormatter = formatNumber, labelFormatter }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs max-w-[240px]">
      <p className="font-semibold mb-1 break-words">{labelFormatter ? labelFormatter(label, payload) : label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums ml-auto">{valueFormatter(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const LegendText = (value) => <span style={{ color: 'hsl(var(--foreground))', fontSize: 12 }}>{value}</span>;

const truncar = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Rótulo de categoria em uma linha só (o padrão do recharts quebra a palavra).
const CategoriaTick = ({ x, y, payload, max }) => (
  <text x={x} y={y} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={12}>
    <title>{payload.value}</title>
    {truncar(String(payload.value ?? ''), max)}
  </text>
);

// Gasto de material por obra: barras horizontais empilhadas (entregue na obra
// + usado por funcionário). data: [{ nome, entregue, usado, total }]
export const GastoPorObraChart = ({ data }) => {
  const altura = Math.max(160, data.length * 44 + 60);
  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={formatCurrencyCurto} />
          <YAxis
            type="category" dataKey="nome" width={104} axisLine={false} tickLine={false}
            tick={<CategoriaTick max={14} />}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
            content={(
              <TooltipBox
                valueFormatter={formatCurrency}
                labelFormatter={(label, payload) => `${label} · ${formatCurrency(payload?.[0]?.payload?.total)}`}
              />
            )}
          />
          <Legend formatter={LegendText} iconType="square" iconSize={10} wrapperStyle={{ paddingTop: 4 }} />
          <Bar isAnimationActive={false} dataKey="entregue" name="Entregue na obra" stackId="g" fill={COR_SERIE_1} stroke="hsl(var(--card))" strokeWidth={1} />
          <Bar isAnimationActive={false} dataKey="usado" name="Usado por funcionário" stackId="g" fill={COR_SERIE_2} stroke="hsl(var(--card))" strokeWidth={1} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Movimentações aprovadas por dia (últimos 30 dias): entradas x saídas.
// data: [{ dia: 'dd/mm', entradas, saidas }]
export const MovimentacoesDiaChart = ({ data }) => (
  <div className="h-64 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={1} barCategoryGap="20%" maxBarSize={14}>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
        <XAxis dataKey="dia" tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (max) => Math.max(2, max)]} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
          content={<TooltipBox valueFormatter={(v) => `${formatNumber(v)} mov.`} />}
        />
        <Legend formatter={LegendText} iconType="square" iconSize={10} />
        <Bar isAnimationActive={false} dataKey="entradas" name="Entradas" fill={COR_SERIE_1} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="saidas" name="Saídas" fill={COR_SERIE_2} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// Pedidos por status: uma série só (quantidade). data: [{ status, total }]
export const PedidosStatusChart = ({ data }) => {
  const altura = Math.max(140, data.length * 36 + 30);
  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }} barCategoryGap="25%">
          <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category" dataKey="status" width={128} axisLine={false} tickLine={false}
            tick={<CategoriaTick max={19} />}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
            content={<TooltipBox valueFormatter={(v) => `${formatNumber(v)} pedido(s)`} />}
          />
          <Bar
            isAnimationActive={false}
            dataKey="total" name="Pedidos" fill={COR_SERIE_1} radius={[0, 4, 4, 0]}
            label={{ position: 'right', fill: 'hsl(var(--foreground))', fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
