/**
 * Reusable Structured Data (JSON-LD) Component
 *
 * Renders schema.org structured data as a <script type="application/ld+json"> tag.
 * Accepts either a single schema object or an array of schemas.
 *
 * Usage:
 *   <StructuredData data={mySchema} />
 *   <StructuredData data={[schema1, schema2]} />
 *
 * Available schema generators from @/lib/seo:
 *   - generateLocalBusinessSchema()
 *   - generateOrganizationSchema()
 *   - generateWebSiteSchema()
 *   - generateArticleSchema({ title, description, image, datePublished, author, url })
 *   - generateServiceSchema({ name, description, image?, url })
 *   - generatePersonSchema({ name, jobTitle, description?, image?, email?, telephone?, url })
 *   - generateFAQSchema([{ question, answer }])
 *   - generateBreadcrumbSchema([{ name, url }])
 *   - generateReviewSchema({ reviewBody, ratingValue, authorName, datePublished? })
 *   - generateHowToSchema({ name, description, steps, totalTime?, estimatedCost? })
 *   - generateContactPageSchema()
 *   - generateAboutPageSchema()
 *   - generateCollectionPageSchema({ name, description, url, numberOfItems? })
 *   - generateVideoSchema({ name, description, thumbnailUrl, uploadDate, duration?, contentUrl?, embedUrl? })
 */

interface StructuredDataProps {
  /** A single schema object or an array of schema objects */
  data: Record<string, unknown> | Record<string, unknown>[];
}

export default function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
