import { useState } from "react";

/** Headshot with an editorial monogram fallback for missing/broken images. */
export default function AgentAvatar({
  src,
  name,
  className = "",
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join("");

  if (!src || failed) {
    return (
      <div
        className={`bg-foreground text-background flex items-center justify-center ${className}`}
      >
        <span className="font-display font-bold text-[1.6em] tracking-wide">{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover object-top ${className}`}
    />
  );
}
