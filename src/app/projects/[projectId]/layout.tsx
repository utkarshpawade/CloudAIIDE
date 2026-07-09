import { ProjectIdLayout } from "@/features/projects/components/project-id-layout";
import { AuthGuard } from "@/features/auth/components/auth-guard";

import { Id } from "../../../../convex/_generated/dataModel";

const Layout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>
}) => {
  const { projectId } = await params;

  return (
    <AuthGuard>
      <ProjectIdLayout
        projectId={projectId as Id<"projects">}
      >
        {children}
      </ProjectIdLayout>
    </AuthGuard>
  );
}
 
export default Layout;
