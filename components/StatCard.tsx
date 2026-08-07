type StatCardProps = {
  title: string;
  value: string;
};

export default function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="rounded-2xl pf-v2-s-hi p-4 shadow-sm">
      <p className="text-sm pf-v2-t-40">{title}</p>
      <h2 className="mt-2 text-xl font-semibold">{value}</h2>
    </div>
  );
}