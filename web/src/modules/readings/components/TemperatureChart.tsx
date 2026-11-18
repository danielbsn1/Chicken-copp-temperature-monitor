import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { formatTemp } from "../../../shared/format/number";
import { EmptyState } from "../../../shared/ui";

export interface TemperaturePoint {
  /** Rótulo do eixo X, já formatado (horas em America/Sao_Paulo). */
  time: string;
  min: number;
  avg: number;
  max: number;
}

interface TemperatureChartProps {
  points: TemperaturePoint[];
}

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
      <LineChart width={640} height={260} data={points} accessibilityLayer={false}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis unit=" °C" domain={["auto", "auto"]} />
        <ReferenceLine y={30} strokeDasharray="6 4" label="30 °C" />
        <ReferenceLine y={35} strokeDasharray="6 4" label="35 °C" />
        <Line dataKey="min" name="Mínima" dot={false} isAnimationActive={false} />
        <Line dataKey="avg" name="Média" dot={false} isAnimationActive={false} />
        <Line dataKey="max" name="Máxima" dot={false} isAnimationActive={false} />
      </LineChart>
    </div>
  );
}
