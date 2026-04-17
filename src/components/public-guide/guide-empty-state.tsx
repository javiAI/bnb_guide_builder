interface Props {
  copy?: string;
}

const DEFAULT_COPY = "Esta sección todavía no tiene contenido.";

export function GuideEmptyState({ copy }: Props) {
  return (
    <p className="guide-section__empty">{copy ?? DEFAULT_COPY}</p>
  );
}
