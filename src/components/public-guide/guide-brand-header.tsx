interface Props {
  title: string;
  logoUrl?: string | null;
}

export function GuideBrandHeader({ title, logoUrl }: Props) {
  return (
    <header className="guide-brand-header" role="banner">
      {logoUrl ? (
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
