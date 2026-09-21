import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { JobForm } from "../../job-form";

export default function NewJobPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">New job</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <NewJob />
      </Suspense>
    </>
  );
}

async function NewJob() {
  await connection();
  const companies = await db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (companies.length === 0) {
    return (
      <p className="text-sm text-muted">
        Add a company first:{" "}
        <Link href="/admin/companies/new" className="text-fg underline underline-offset-4">
          new company
        </Link>
      </p>
    );
  }
  return <JobForm companies={companies} />;
}
