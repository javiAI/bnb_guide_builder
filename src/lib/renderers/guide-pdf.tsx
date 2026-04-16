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
  return (
    <View style={depth === 0 ? styles.item : styles.nested}>
      <Text>
        <Text style={styles.itemLabel}>{item.label}</Text>
        {item.deprecated ? <Text style={styles.deprecated}> (deprecated)</Text> : null}
        {item.value ? <Text style={styles.itemValue}>: {item.value}</Text> : null}
      </Text>
      {item.fields.map((f, i) => (
        <Text key={i} style={styles.fieldRow}>
          {f.label}: {f.value}
        </Text>
      ))}
      {item.media
        .filter((m) => /^https?:\/\//i.test(m.url))
        .map((m, i) => (
          <Image key={i} src={m.url} style={styles.image} />
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
        {tree.sections.map((section) => (
          <View key={section.id}>
            <Text style={styles.sectionTitle}>{section.label}</Text>
            {section.items.length === 0 ? (
              <Text style={styles.empty}>Sin elementos.</Text>
            ) : (
              section.items.map((item) => (
                <ItemView key={item.id} item={item} depth={0} />
              ))
            )}
          </View>
        ))}
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
