import { SectionCard } from "@/components/admin/page-header";
import { TeamPanel } from "../team-panel";

type Member = React.ComponentProps<typeof TeamPanel>["members"][number];
type Property = React.ComponentProps<typeof TeamPanel>["properties"][number];

export function TeamClientTab({
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
