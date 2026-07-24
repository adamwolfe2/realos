import { SectionCard } from "@/components/admin/page-header";
import { TeamPanel } from "./team-panel";
import { UserRole } from "@prisma/client";

type Member = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  clerkUserId: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  propertyIds: string[];
};

type Property = { id: string; name: string };

export function TeamTab({
  members,
  properties,
}: {
  members: Member[];
  properties: Property[];
}) {
  return (
    <SectionCard
      label="Team members"
      description="Roles are enforced immediately. Removing a user revokes their Clerk session and any pending invites for that email."
    >
      <TeamPanel members={members} properties={properties} />
    </SectionCard>
  );
}
