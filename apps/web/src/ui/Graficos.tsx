import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PALETA = ['#115235', '#1f7a4d', '#4ea57a', '#8cc9a8', '#c2e3d1', '#e8a33d'];

export interface FilaGrafico {
  nombre: string;
  valor: number;
  /** Texto que se muestra: nunca se deriva del número del gráfico. */
  etiqueta: string;
}

function Globo({ active, payload }: { active?: boolean; payload?: { payload: FilaGrafico }[] }) {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  return (
    <div className="rounded-lg bg-gray-900 px-2 py-1 text-xs text-white">
      {f.nombre}: {f.etiqueta}
    </div>
  );
}

export function GraficoBarras({ datos, destacar }: { datos: FilaGrafico[]; destacar?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <XAxis dataKey="nombre" tick={{ fontSize: 11 }} interval={0} />
        <YAxis hide />
        <Tooltip content={<Globo />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {datos.map((d) => (
            <Cell key={d.nombre} fill={d.nombre === destacar ? '#e8a33d' : '#1f7a4d'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoCirculo({ datos }: { datos: FilaGrafico[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={datos}
          dataKey="valor"
          nameKey="nombre"
          innerRadius={45}
          outerRadius={75}
          isAnimationActive={false}
        >
          {datos.map((d, i) => (
            <Cell key={d.nombre} fill={PALETA[i % PALETA.length]} />
          ))}
        </Pie>
        <Tooltip content={<Globo />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
