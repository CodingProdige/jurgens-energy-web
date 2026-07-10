import { redirect } from "next/navigation";

export default function AdminBrandRequestsRedirectPage() {
  redirect("/catalog/brands");
}
