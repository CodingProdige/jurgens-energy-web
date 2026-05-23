export function RestrictedAdminPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#101214]">
      <h1 className="text-2xl font-bold text-zinc-950 dark:text-white">
        Restricted
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-zinc-300">
        You do not have permission to view this admin area.
      </p>
    </div>
  );
}
