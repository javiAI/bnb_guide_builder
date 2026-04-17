/**
 * PDF renderer for `GuideTree`. Uses `@react-pdf/renderer` server-side —
 * no headless browser, no external binary. Returns a Buffer ready to stream
 * from an API route with `Content-Type: application/pdf`.
 *
 * Layout mirrors the markdown/html hierarchy (sections → items → fields +
 * media + children) without trying to be pixel-perfect. The goal is a
 * printable handout, not a design deliverable.
 */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";
import {
  filterRenderableItems,
  resolveDisplayFields,
  resolveDisplayValue,
  resolveEmptyCopy,
  shouldHideSection,
} from "./_guide-display";

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 48, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 20, borderBottom: "1 solid #d4d4d4", paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: "bold" },
  subtitle: { fontSize: 9, color: "#737373", marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginTop: 16, marginBottom: 6 },
  empty: { fontSize: 10, color: "#a3a3a3", fontStyle: "italic" },
  item: { marginBottom: 6 },
  itemLabel: { fontSize: 10, fontWeight: "bold" },
  itemValue: { fontSize: 10 },
  fieldRow: { fontSize: 9, marginLeft: 10, color: "#404040" },
  deprecated: { fontSize: 9, color: "#a16207", fontStyle: "italic" },
  image: { marginTop: 4, marginLeft: 10, maxWidth: 200, maxHeight: 140, objectFit: "contain" },
  nested: { marginLeft: 12, marginTop: 4 },
});

function ItemView({ item, depth }: { item: GuideItem; depth: number }) {
  const displayValue = resolveDisplayValue(item);
  const displayFields = resolveDisplayFields(item);
  return (
    <View style={depth === 0 ? styles.item : styles.nested}>
      <Text>
        <Text style={styles.itemLabel}>{item.label}</Text>
        {item.deprecated ? <Text style={styles.deprecated}> (deprecated)</Text> : null}
        {displayValue ? <Text style={styles.itemValue}>: {displayValue}</Text> : null}
      </Text>
      {displayFields.map((f, i) => (
        <Text key={i} style={styles.fieldRow}>
          {f.label}: {f.value}
        </Text>
      ))}
      {/* PDF needs absolute URLs; proxy paths (`/g/...`) are relative and
          skipped until the PDF pipeline is taught to prepend an origin. */}
      {item.media
        .filter((m) => /^https?:\/\//i.test(m.variants.md))
        .map((m, i) => (
          // @react-pdf/renderer's Image is not the HTML/Next Image element and
          // does not support `alt` — the a11y rule fires on tag name alone.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image key={i} src={m.variants.md} style={styles.image} />
        ))}
      {item.children.map((child) => (
        <ItemView key={child.id} item={child} depth={depth + 1} />
      ))}
    </View>
  );
}

function GuideDocument({ tree }: { tree: GuideTree }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {tree.propertyId} — audiencia: {tree.audience}
          </Text>
          <Text style={styles.subtitle}>Generado: {tree.generatedAt}</Text>
        </View>
        {tree.sections.map((section) => {
          const renderable = filterRenderableItems(section.items, tree.audience);
          if (shouldHideSection(section, tree.audience, renderable)) return null;
          const emptyCopy = resolveEmptyCopy(section, tree.audience);
          return (
            <View key={section.id}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {renderable.length === 0 ? (
                emptyCopy ? (
                  <Text style={styles.empty}>{emptyCopy}</Text>
                ) : tree.audience !== "guest" ? (
                  <Text style={styles.empty}>Sin elementos.</Text>
                ) : null
              ) : (
                renderable.map((item) => (
                  <ItemView key={item.id} item={item} depth={0} />
                ))
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export async function renderPdf(tree: GuideTree): Promise<Buffer> {
  const stream = await pdf(<GuideDocument tree={tree} />).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }
  return Buffer.concat(chunks);
}
