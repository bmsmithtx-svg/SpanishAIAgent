import Link from "next/link";

type FeatureCardProps = {
  index: string;
  title: string;
  status: string;
  description: string;
  tone?: "teal" | "gold" | "rose" | "green";
  href?: string;
  actionLabel?: string;
};

export function FeatureCard({
  index,
  title,
  status,
  description,
  tone = "teal",
  href,
  actionLabel = "Open"
}: FeatureCardProps) {
  const cardContent = (
    <article className="card">
      <div className="card-topline">
        <span className="card-index">{index}</span>
        <span className={`badge ${tone}`}>{status}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {href ? <span className="card-action-label">{actionLabel}</span> : null}
    </article>
  );

  return href ? (
    <Link className="card-link" href={href}>
      {cardContent}
    </Link>
  ) : (
    cardContent
  );
}
