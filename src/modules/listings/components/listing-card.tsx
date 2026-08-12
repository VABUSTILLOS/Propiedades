"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  deleteListing,
  setListingStatus,
} from "@/modules/listings/actions";
import { scoreListing } from "@/modules/ai/actions";
import { CreateFlyerButton } from "@/modules/flyers/components/create-flyer-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PropertiesRow } from "@/modules/lib/database.types";

const STATUS_LABELS: Record<PropertiesRow["status"], string> = {
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  active: "Activo",
  reserved: "Reservado",
  sold: "Vendido",
  archived: "Archivado",
};

const STATUS_VARIANTS: Record<
  PropertiesRow["status"],
  "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
> = {
  draft: "secondary",
  pending_approval: "outline",
  active: "default",
  reserved: "ghost",
  sold: "ghost",
  archived: "ghost",
};

export function ListingCard({ listing }: { listing: PropertiesRow }) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(
    listing.property_score,
  );

  const publish = () =>
    startTransition(async () => {
      setActionError(null);
      const res = await setListingStatus(listing.id, "active");
      if (!res.ok) setActionError(res.error);
    });

  const archive = () =>
    startTransition(async () => {
      setActionError(null);
      const res = await setListingStatus(listing.id, "archived");
      if (!res.ok) setActionError(res.error);
    });

  const remove = () =>
    startTransition(async () => {
      setActionError(null);
      const res = await deleteListing(listing.id);
      if (!res.ok) setActionError(res.error);
    });

  const runScore = () =>
    startTransition(async () => {
      setActionError(null);
      const res = await scoreListing(listing.id);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setAiScore(res.data.score);
    });

  const canPublish =
    listing.status === "draft" || listing.status === "archived";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2">
          <Link
            href={`/property/${listing.slug}`}
            className="hover:underline"
          >
            {listing.title}
          </Link>
          <Badge variant={STATUS_VARIANTS[listing.status]}>
            {STATUS_LABELS[listing.status]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {listing.description ?? "Sin descripción todavía."}
        </p>
        {listing.price > 0 && (
          <p className="mt-2 text-sm font-semibold">
            ${listing.price.toLocaleString()} MXN
          </p>
        )}
        {aiScore !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            AI score: {aiScore.toFixed(1)}/100
          </p>
        )}
        {actionError && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {actionError}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          size="sm"
          disabled={!canPublish || isPending}
          onClick={publish}
        >
          {listing.status === "draft" ? "Publish" : "Re-publish"}
        </Button>
        {listing.status === "active" && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={archive}>
            Archive
          </Button>
        )}
        {listing.status !== "active" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={remove}
          >
            Delete
          </Button>
        )}
        <Link
          href={`/property/${listing.slug}`}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          View
        </Link>
        {listing.status === "active" && (
          <CreateFlyerButton propertyId={listing.id} />
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={runScore}
        >
          {aiScore !== null ? "Re-score" : "AI score"}
        </Button>
      </CardFooter>
    </Card>
  );
}
