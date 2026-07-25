/**
 * Game art image. Inside a button or link, keep the default alt="" — a named alt
 * changes the element's accessible name, which the e2e suite pins (AGENTS.md).
 */
export function GameIcon({
  src,
  alt = "",
  size = 20,
  className,
}: {
  src: string;
  alt?: string;
  size?: number;
  className?: string;
}) {
  // Plain img: game art is small static PNG from public/, next/image buys nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={size} height={size} className={className} />;
}
