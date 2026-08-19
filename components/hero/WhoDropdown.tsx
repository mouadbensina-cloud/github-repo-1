import { Icon } from "@/components/ui/Icon";
import {
  MAX_ADULTS_PER_ROOM,
  MAX_CHILDREN_PER_ROOM,
  MAX_CHILD_AGE,
  type GuestRoom,
} from "@/lib/search-params";

/**
 * The form's working copy of a room. Ages are nullable HERE and only here:
 * LiteAPI requires a real age for every child (`children` is a list of ages,
 * not a count), so adding a child has to create an explicitly empty slot the
 * user must fill rather than a silently-assumed age. `toGuestRooms` below is
 * the one place that narrows this to the API-ready GuestRoom.
 */
export type DraftRoom = { adults: number; childAges: (number | null)[] };

const MIN_ADULTS = 1;

export const DEFAULT_ROOMS: DraftRoom[] = [{ adults: 2, childAges: [] }];

/** Every child has an age set — the precondition for searching at all. */
export function roomsAreComplete(rooms: DraftRoom[]): boolean {
  return rooms.every((room) => room.childAges.every((age) => age !== null));
}

/** Narrows the draft to the API shape. Only safe once roomsAreComplete(). */
export function toGuestRooms(rooms: DraftRoom[]): GuestRoom[] {
  return rooms.map((room) => ({
    adults: room.adults,
    childAges: room.childAges.filter((age): age is number => age !== null),
  }));
}

export function guestsLabelFor(rooms: DraftRoom[]): string {
  const adults = rooms.reduce((sum, room) => sum + room.adults, 0);
  const children = rooms.reduce((sum, room) => sum + room.childAges.length, 0);
  const guests = adults + children;
  return `${guests} Guest${guests === 1 ? "" : "s"} · ${rooms.length} Room${
    rooms.length === 1 ? "" : "s"
  }`;
}

/**
 * The Who field's dropdown (Figma 33214:32031) — one counter block per room,
 * "Add room" appends another. The room COUNT is the array length, matching
 * LiteAPI's `occupancies` array exactly (one object per room), so nothing has
 * to be reshaped between this UI and the request.
 *
 * Apply is a confirm-and-close rather than a commit step — the +/- controls
 * write straight to the applied state, since the design has no Cancel — but
 * it is disabled while any child is missing an age.
 */
export function WhoDropdown({
  rooms,
  onChange,
  onApply,
}: {
  rooms: DraftRoom[];
  onChange: (rooms: DraftRoom[]) => void;
  onApply: () => void;
}) {
  const complete = roomsAreComplete(rooms);

  const updateRoom = (index: number, patch: Partial<DraftRoom>) => {
    onChange(rooms.map((room, i) => (i === index ? { ...room, ...patch } : room)));
  };

  const setChildCount = (index: number, next: number) => {
    const room = rooms[index];
    const childAges =
      next > room.childAges.length
        ? // New slots start empty on purpose — see DraftRoom.
          [...room.childAges, ...Array(next - room.childAges.length).fill(null)]
        : room.childAges.slice(0, next);
    updateRoom(index, { childAges });
  };

  const setChildAge = (roomIndex: number, childIndex: number, age: number) => {
    const room = rooms[roomIndex];
    updateRoom(roomIndex, {
      childAges: room.childAges.map((current, i) =>
        i === childIndex ? age : current,
      ),
    });
  };

  return (
    <div className="flex w-[390px] flex-col items-start gap-4 p-6">
      <p className="w-full font-display text-[16px] font-bold text-neutral-900">
        Configure rooms
      </p>
      <span className="h-px w-full bg-neutral-200" />

      <div className="flex w-full flex-col gap-5">
        {rooms.map((room, index) => (
          <div key={index} className="flex w-full flex-col gap-5 py-2">
            <div className="flex w-full items-center justify-between">
              <p className="font-display text-[14px] font-bold text-neutral-900">
                Room {index + 1}
              </p>
              {rooms.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onChange(rooms.filter((_, i) => i !== index))}
                  className="cursor-pointer font-display text-[12px] font-medium text-brand underline"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <GuestCounter
              label="Adults"
              value={room.adults}
              min={MIN_ADULTS}
              max={MAX_ADULTS_PER_ROOM}
              onChange={(adults) => updateRoom(index, { adults })}
            />
            <GuestCounter
              label="Children"
              sublabel={`Ages 0 to ${MAX_CHILD_AGE}`}
              value={room.childAges.length}
              min={0}
              max={MAX_CHILDREN_PER_ROOM}
              onChange={(count) => setChildCount(index, count)}
            />

            {room.childAges.length ? (
              <div className="flex w-full flex-col gap-2">
                <p className="font-display text-[12px] text-neutral-500">
                  Age at check-out
                </p>
                <div className="flex flex-wrap gap-2">
                  {room.childAges.map((age, childIndex) => (
                    <label
                      key={childIndex}
                      className="flex flex-col gap-1"
                      aria-label={`Age of child ${childIndex + 1} in room ${index + 1}`}
                    >
                      <span className="sr-only">
                        Age of child {childIndex + 1}
                      </span>
                      <select
                        value={age ?? ""}
                        onChange={(event) =>
                          setChildAge(index, childIndex, Number(event.target.value))
                        }
                        className={`h-9 w-[86px] cursor-pointer rounded-[8px] border bg-white px-2 font-display text-[13px] text-neutral-900 outline-none transition-colors ${
                          age === null
                            ? "border-amber-400 text-neutral-400"
                            : "border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        <option value="" disabled>
                          Age
                        </option>
                        {Array.from({ length: MAX_CHILD_AGE + 1 }, (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? "Under 1" : i}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!complete ? (
        <p className="font-display text-[12px] text-amber-700">
          Add an age for each child to search — properties price children by
          age.
        </p>
      ) : null}

      <div className="flex w-full items-start gap-2.5">
        <button
          type="button"
          onClick={() => onChange([...rooms, { adults: 1, childAges: [] }])}
          className="flex h-10 w-[164px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-neutral-200 bg-white pr-3.5 pl-3 font-display text-[14px] font-medium tracking-[-0.14px] text-neutral-900 transition-colors hover:bg-surface"
        >
          <Icon name="plus" size={16} />
          Add room
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!complete}
          className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[8px] bg-brand font-display text-[14px] font-medium tracking-[-0.112px] text-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function GuestCounter({
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className="flex w-full items-center justify-between">
      <span className="flex items-center gap-2.5">
        <span className="font-display text-[14px] font-medium text-[#101828]">
          {label}
        </span>
        {sublabel ? (
          <span className="font-display text-[12px] text-[#667085]">
            {sublabel}
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={atMin}
          onClick={() => onChange(value - 1)}
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
            atMin
              ? "cursor-not-allowed border-neutral-200 bg-surface text-neutral-300"
              : "cursor-pointer border-neutral-300 text-neutral-900 hover:border-neutral-400"
          }`}
        >
          <Icon name="minus" size={14} />
        </button>
        <span className="w-4 text-center font-display text-[16px] font-medium text-neutral-900">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={atMax}
          onClick={() => onChange(value + 1)}
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
            atMax
              ? "cursor-not-allowed border-neutral-200 bg-surface text-neutral-300"
              : "cursor-pointer border-neutral-300 text-neutral-900 hover:border-neutral-400"
          }`}
        >
          <Icon name="plus" size={14} />
        </button>
      </span>
    </div>
  );
}
