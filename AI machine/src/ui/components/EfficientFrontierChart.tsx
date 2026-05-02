import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FrontierPoint } from "../../domain/portfolio/types";

interface EfficientFrontierChartProps {
  data: FrontierPoint[];
  targetVolatilityPct: number;
}

export const EfficientFrontierChart = ({ data, targetVolatilityPct }: EfficientFrontierChartProps) => {
  if (data.length === 0) {
    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Efficient Frontier</h2>
          <span>QUBO Target</span>
        </div>
        <div className="empty-state">No frontier data available.</div>
      </section>
    );
  }

  const target = data.reduce((closest, point) =>
    Math.abs(point.volatilityPct - targetVolatilityPct) < Math.abs(closest.volatilityPct - targetVolatilityPct) ? point : closest
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Efficient Frontier</h2>
        <span>QUBO Target</span>
      </div>
      <div className="h-72">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#1E1E22" strokeDasharray="4 4" />
            <XAxis
              dataKey="volatilityPct"
              tick={{ fontSize: 11, fill: "#7A7A82", fontFamily: "IBM Plex Mono" }}
              tickLine={false}
              axisLine={{ stroke: "#1E1E22" }}
              unit="%"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#7A7A82", fontFamily: "IBM Plex Mono" }}
              tickLine={false}
              axisLine={{ stroke: "#1E1E22" }}
              unit="%"
            />
            <Tooltip
              contentStyle={{ background: "#0D0D0F", border: "1px solid #1E1E22", borderRadius: 0, color: "#D4CFC8", fontSize: 12 }}
            />
            <Line type="monotone" dataKey="expectedReturnPct" stroke="#E8A030" strokeWidth={1.5} dot={{ r: 3, fill: "#0A0A0B" }} />
            <ReferenceDot
              x={target.volatilityPct}
              y={target.expectedReturnPct}
              r={5}
              fill="#4CAF74"
              stroke="#0A0A0B"
              strokeWidth={1}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
