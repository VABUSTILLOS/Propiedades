import { cn } from "@/lib/utils";
import { logoAssets } from "@/modules/brand/data";

export function LogoAsset({ index }: { index: number }) {
  const asset = logoAssets[index];
  if (!asset) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <div
        className={cn(
          "flex h-36 items-center justify-center rounded-lg ring-1 ring-foreground/10",
          asset.background
        )}
      >
        <img src={asset.src} alt={asset.name} className={asset.className} />
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{asset.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{asset.fileName}</p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{asset.note}</p>
      </div>
    </div>
  );
}
