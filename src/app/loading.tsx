export default function Loading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
      </div>
      <div className="skeleton h-64 rounded-xl" />
    </div>
  );
}
