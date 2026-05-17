"use client";

import { Navbar } from "./navbar";
import { Id } from "../../../../convex/_generated/dataModel";

export const ProjectIdLayout = ({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: Id<"projects">;
}) => {
  return (
    <div className="w-full h-screen flex flex-col">
      <Navbar projectId={projectId} />
      <div className="flex-1 flex overflow-hidden">
        {children}
      </div>
    </div>
  );
};
