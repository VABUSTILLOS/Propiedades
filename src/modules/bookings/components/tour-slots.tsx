"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";

import { bookSlot, createSlot } from "@/modules/bookings/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AvailabilitySlotsRow } from "@/modules/lib/database.types";

type Props = {
  propertyId: string;
  ownerId: string;
  currentUserId: string;
  slots: AvailabilitySlotsRow[];
};

/**
 * Tour scheduling. Owners can open new slots; buyers book available ones.
 */
export function TourSlots({ propertyId, ownerId, currentUserId, slots }: Props) {
  const isOwner = ownerId === currentUserId;
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const addSlot = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const start = new Date(`${date}T${startTime}:00`);
      const end = new Date(`${date}T${endTime}:00`);
      const res = await createSlot({
        propertyId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Slot added.");
      setDate("");
      setStartTime("");
      setEndTime("");
    });

  const book = (slotId: string) =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await bookSlot({ slotId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Tour booked.");
    });

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Schedule a tour</h3>

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-2 text-sm text-emerald-600" role="status">
          {message}
        </p>
      )}

      {isOwner && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Start
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="block rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            End
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="block rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <Button
            size="sm"
            disabled={isPending || !date || !startTime || !endTime}
            onClick={addSlot}
          >
            Add slot
          </Button>
        </div>
      )}

      {slots.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No available tour slots yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {slots.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <span>
                {format(new Date(slot.start_time), "EEE, MMM d · HH:mm")} –{" "}
                {format(new Date(slot.end_time), "HH:mm")}
              </span>
              {!isOwner && !slot.is_booked && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => book(slot.id)}
                >
                  Book
                </Button>
              )}
              {isOwner && (
                <Badge variant="outline">Available</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
