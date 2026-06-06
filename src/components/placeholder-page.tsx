import { PageHeader } from "@/components/page-header";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryTitle: string;
  primaryCopy: string;
  secondaryTitle: string;
  steps: Array<{
    title: string;
    copy: string;
  }>;
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  primaryTitle,
  primaryCopy,
  secondaryTitle,
  steps
}: PlaceholderPageProps) {
  return (
    <div className="page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        badges={[{ label: "PDF-only placeholder", tone: "gold" }]}
      />

      <section className="placeholder-layout">
        <article className="placeholder-panel">
          <span className="badge teal">Planned workspace</span>
          <h2>{primaryTitle}</h2>
          <p>{primaryCopy}</p>
          <span className="code-pill">Awaiting uploaded PDF source records</span>
        </article>

        <aside className="placeholder-panel">
          <span className="badge rose">{secondaryTitle}</span>
          <div className="stack" style={{ marginTop: 14 }}>
            {steps.map((step) => (
              <div className="timeline-item" key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.copy}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
