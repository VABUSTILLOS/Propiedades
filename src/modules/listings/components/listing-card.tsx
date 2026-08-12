"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  deleteListing,
  setListingStatus,
  updateListingCategory,
  updateListingContact,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PropertiesRow,
  PropertyCategory,
} from "@/modules/lib/database.types";

const CATEGORY_LABELS: Record<PropertyCategory, string> = {
  casa: "Casa",
  departamento: "Departamento",
  local: "Local",
  bodega: "Bodega",
  terreno: "Terreno",
};

const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as PropertyCategory[];

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

  const changeCategory = (category: string) =>
    startTransition(async () => {
      setActionError(null);
      const res = await updateListingCategory(listing.id, category);
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
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Categoría
          </span>
          <Select
            value={listing.category}
            onValueChange={(v) => {
              if (v) changeCategory(v);
            }}
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_VALUES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        <EditContactDialog listing={listing} />
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

function EditContactDialog({ listing }: { listing: PropertiesRow }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(listing.contact_name ?? "");
  const [type, setType] = useState(listing.contact_type ?? "");
  const [phone, setPhone] = useState(listing.contact_phone ?? "");
  const [whatsapp, setWhatsapp] = useState(listing.contact_whatsapp ?? "");
  const [email, setEmail] = useState(listing.contact_email ?? "");

  const reset = () => {
    setName(listing.contact_name ?? "");
    setType(listing.contact_type ?? "");
    setPhone(listing.contact_phone ?? "");
    setWhatsapp(listing.contact_whatsapp ?? "");
    setEmail(listing.contact_email ?? "");
    setError(null);
    setSaved(false);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const res = await updateListingContact(listing.id, {
        contact_name: name.trim() || null,
        contact_type: type || null,
        contact_phone: phone.trim() || null,
        contact_whatsapp: whatsapp.trim() || null,
        contact_email: email.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            Editar contacto
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar contacto</DialogTitle>
          <DialogDescription>
            Guarda el nombre y WhatsApp del agente inmobiliario responsable de
            esta propiedad.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Nombre de contacto</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Inmobiliaria Vanguardia"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-type">Tipo de contacto</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? "")}>
              <SelectTrigger id="contact-type">
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inmobiliaria">Inmobiliaria</SelectItem>
                <SelectItem value="agencia">Agencia</SelectItem>
                <SelectItem value="particular">Particular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Teléfono</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+52 55 0000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-whatsapp">WhatsApp</Label>
              <Input
                id="contact-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+52 55 0000 0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">Correo electrónico</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contacto@inmobiliaria.com"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm text-emerald-600" role="status">
              Contacto guardado.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button disabled={isPending} onClick={save}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
