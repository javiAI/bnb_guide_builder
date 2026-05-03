import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { TextLink } from "@/components/ui/text-link";
import { TimelineList } from "@/components/ui/timeline-list";
import { formatRelativeEs } from "@/lib/format-relative-es";
import type { BadgeTone } from "@/lib/types";

export interface ActivityFeedItem {
  id: string;
  message: string;
  whenISO: string;
  tone?: BadgeTone;
}

interface ActivityFeedCardProps {
  propertyId: string;
  items: ActivityFeedItem[];
}

export function ActivityFeedCard({ propertyId, items }: ActivityFeedCardProps) {
  return (
    <Card variant="overview">
      <div className="mb-3 flex items-start justify-between">
        <SectionEyebrow icon={Activity}>Actividad reciente</SectionEyebrow>
        <TextLink href={`/properties/${propertyId}/activity`}>Ver todo</TextLink>
      </div>

      <TimelineList
        items={items.map((item) => ({
          id: item.id,
          tone: item.tone,
          content: item.message,
          meta: formatRelativeEs(item.whenISO),
        }))}
        emptyText="Sin actividad reciente."
      />
    </Card>
  );
}
