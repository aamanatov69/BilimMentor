import { redirect } from "next/navigation";

export default function AdminToolsPage() {
  redirect("/dashboard/admin/settings");
}
