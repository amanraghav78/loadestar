import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { deleteJob } from "../../actions";
import { JobForm } from "../../job-form";

export default function EditJobPage({ params }: PageProps<"/admin/jobs/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      {params.then(({ id }) => (
        <EditJob id={id} />
      ))}
    </Suspense>
  );
}

async function EditJob({ id }: { id: string }) {
  await connection();
  const [job, companies] = await Promise.all([
    db.job.findUnique({ where: { id } }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!job) notFound();

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Edit: {job.title}</h1>
      <JobForm job={job} companies={companies} />
      <form action={deleteJob} className="mt-12 border-t border-line pt-6">
        <input type="hidden" name="id" value={job.id} />
        <p className="mb-3 text-sm text-muted">
          Deleting removes the listing and its click history. To take a filled role down, use &ldquo;Take
          down&rdquo; on the jobs list instead.
        </p>
        <button className="text-sm text-danger hover:underline">Delete permanently</button>
      </form>
    </>
  );
}
