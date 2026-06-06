type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  badges?: Array<{
    label: string;
    tone?: "teal" | "gold" | "rose" | "green";
  }>;
};

export function PageHeader({ eyebrow, title, description, badges = [] }: PageHeaderProps) {
  return (
    <section className="page-header">
      <div className="eyebrow-row">
        {eyebrow ? <span className="badge teal">{eyebrow}</span> : null}
        {badges.map((badge) => (
          <span className={`badge ${badge.tone ?? ""}`} key={badge.label}>
            {badge.label}
          </span>
        ))}
      </div>
      <h1 className="page-title">{title}</h1>
      <p className="page-copy">{description}</p>
    </section>
  );
}
