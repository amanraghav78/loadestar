import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { CompanyForm } from "../../company-form";

export default function EditCompanyPage({ params }: PageProps<"/admin/companies/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      {params.then(({ id }) => (
        <EditCompany id={id} />
      ))}
    </Suspense>
  );
}

async function EditCompany({ id }: { id: string }) {
  await connection();
  const company = await db.company.findUnique({ where: { id } });
  if (!company) notFound();
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Edit: {company.name}</h1>
      <CompanyForm company={company} />
    </>
  );
}
