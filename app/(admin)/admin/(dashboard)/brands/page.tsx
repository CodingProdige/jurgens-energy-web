import { redirect } from "next/navigation";

export default function AdminBrandsRedirectPage() {
  redirect("/catalog/brands");
}
