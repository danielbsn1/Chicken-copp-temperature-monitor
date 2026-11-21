import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTemp } from "../../../shared/format/number";
import { EmptyState } from "../../../shared/ui";

export interface TemperaturePoint {
  /** Rótulo do eixo X, já formatado (horas em America/Sao_Paulo). */
  time: string;
  /** Data e hora completas para o tooltip; sem ela vale `time`. */
  when?: string;
  min: number;
  avg: number;
  max: number;
}

interface TemperatureChartProps {
  points: TemperaturePoint[];
}

const tempTick = (value: number) => formatTemp(value);

export function TemperatureChart({ points }: TemperatureChartProps) {
  if (points.length === 0) return <EmptyState message="Sem leituras no período." />;

  const min = Math.min(...points.map((p) => p.min));
  const max = Math.max(...points.map((p) => p.max));
  const avg = points.reduce((sum, p) => sum + p.avg, 0) / points.length;

  return (
    <div
      role="img"
      aria-label={`Temperatura no período: mínima ${formatTemp(min)}, média ${formatTemp(avg)}, máxima ${formatTemp(max)}`}
    >
      <ResponsiveContainer
        width="100%"
        height={380}
        initialDimension={{ width: 640, height: 380 }}
      >
        <LineChart data={points} accessibilityLayer={false}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="time" minTickGap={32} stroke="var(--color-muted)" />
          <YAxis
            width={72}
            tickFormatter={tempTick}
            domain={[
              (lo: number) => Math.floor(Math.min(lo, 28)),
              (hi: number) => Math.ceil(Math.max(hi, 36)),
            ]}
            stroke="var(--color-muted)"
          />
          <Tooltip
            formatter={(value) => formatTemp(Number(value))}
            labelFormatter={(_label, payload) =>
              (payload[0]?.payload as TemperaturePoint | undefined)?.when ??
              String(_label)
            }
          />
          <Legend />
          <ReferenceLine
            y={30}
            stroke="var(--color-warn)"
            strokeDasharray="6 4"
            label={{
              value: "30 °C",
              position: "insideTopRight",
              fill: "var(--color-warn)",
            }}
          />
          <ReferenceLine
            y={35}
            stroke="var(--color-danger)"
            strokeDasharray="6 4"
            label={{
              value: "35 °C",
              position: "insideTopRight",
              fill: "var(--color-danger)",
            }}
          />
          <Line
            dataKey="min"
            name="Mínima"
            stroke="var(--color-primary)"
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="avg"
            name="Média"
            stroke="var(--color-text)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="max"
            name="Máxima"
            stroke="var(--color-danger)"
            strokeDasharray="1 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
