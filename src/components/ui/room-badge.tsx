import { cn } from "@/lib/utils";
import { Room } from "@/types";

interface RoomBadgeProps {
  room: Room;
  className?: string;
}

const roomColors = {
  AZANIA: "bg-room-azania text-white",
  ALOE: "bg-room-aloe text-white", 
  CYCAD: "bg-room-cycad text-white",
  KHANYA: "bg-room-khanya text-white"
} as const;

export function RoomBadge({ room, className }: RoomBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all duration-200",
      roomColors[room],
      "shadow-sm hover:shadow-md transform hover:scale-105",
      className
    )}>
      {room}
    </span>
  );
}