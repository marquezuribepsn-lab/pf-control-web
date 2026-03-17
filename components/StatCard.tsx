type StatCardProps = {
  title: string;
  value: string;
};

export default function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-neutral-500">{title}</p>
      <h2 className="mt-2 text-xl font-semibold">{value}</h2>
    </div>
  );
}