type FeatureCardProps = {
  index: string;
  title: string;
  status: string;
  description: string;
  tone?: "teal" | "gold" | "rose" | "green";
};

export function FeatureCard({
  index,
  title,
  status,
  description,
  tone = "teal"
}: FeatureCardProps) {
  return (
    <article className="card">
      <div className="card-topline">
        <span className="card-index">{index}</span>
        <span className={`badge ${tone}`}>{status}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
