interface Props {
  title: string;
  logoUrl?: string | null;
}

export function GuideBrandHeader({ title, logoUrl }: Props) {
  return (
    <header className="guide-brand-header" role="banner">
      {logoUrl ? (
        // Logo URL comes from the published snapshot (proxy path /g/:slug/media
        // for R2-backed assets, sometimes absolute). Adding every tenant's
        // domain to next.config.images.remotePatterns isn't tractable.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="guide-brand-header__logo"
          src={logoUrl}
          alt=""
          width={48}
          height={48}
          loading="eager"
        />
      ) : (
        <div
          aria-hidden="true"
          className="guide-brand-header__logo"
          style={{ background: "var(--guide-brand)" }}
        />
      )}
      <div>
        <h1 className="guide-brand-header__title">{title}</h1>
        <p className="guide-brand-header__subtitle">Guía del huésped</p>
      </div>
    </header>
  );
}
