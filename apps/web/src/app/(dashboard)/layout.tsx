import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) redirect("/login?error=no-org");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar orgName={org.name} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
