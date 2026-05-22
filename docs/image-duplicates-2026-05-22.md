# Image Duplicate Report — 2026-05-22

**Total registry rows:** 36
**Unique URLs:** 19
**Duplicate URLs (used by 2+ keys):** 4
**Rows with no URL:** 0
**Approved rows still on placeholder URLs:** 13

## Duplicates — same URL used by multiple keys

| URL | Used by (keys) | Categories |
|---|---|---|
| `/images/north-alabama-generic.jpg` | `city-albertville-hero` · `city-guntersville-hero` · `city-arab-hero` · `city-scottsboro-hero` · `city-fort-payne-hero` · `city-muscle-shoals-hero` · `city-meridianville-hero` · `city-hazel-green-hero` · `city-priceville-hero` · `city-somerville-hero` · `city-default-hero` | city |
| `/images/service-residential.png` | `service-residential-hero` · `service-metal-hero` · `service-coating-hero` · `service-default-hero` | service |
| `/og-image.png` | `og-site-default` · `og-blog-default` · `og-city-default` · `og-service-default` | og |
| `/images/service-storm.jpg` | `service-storm-hero` · `service-emergency-hero` | service |

**What to do:** if these keys SHOULD share an image (e.g. multiple OG defaults pointing at the site default), it's fine. If they shouldn't (e.g. 10 cities all using the same generic photo), each city needs its own image — see `docs/image-update-todo.md` Section A.

## Approved rows still on placeholder URLs

These rows are marked `approved=true` but their `url` is still a known placeholder. Re-source the image and update the row.

| Key | Category | URL | Intent |
|---|---|---|---|
| `city-albertville-hero` | city | `/images/north-alabama-generic.jpg` | Distinctive Albertville landmark or neighborhood |
| `city-guntersville-hero` | city | `/images/north-alabama-generic.jpg` | Lake Guntersville or bridge |
| `city-arab-hero` | city | `/images/north-alabama-generic.jpg` | Brindlee Mountain or downtown Arab |
| `city-scottsboro-hero` | city | `/images/north-alabama-generic.jpg` | Jackson County courthouse or Goose Pond |
| `city-fort-payne-hero` | city | `/images/north-alabama-generic.jpg` | DeSoto State Park or Sock Capital sign |
| `city-muscle-shoals-hero` | city | `/images/north-alabama-generic.jpg` | Wilson Dam or Singing River Bridge |
| `city-meridianville-hero` | city | `/images/north-alabama-generic.jpg` | Highway 231 corridor neighborhood |
| `city-hazel-green-hero` | city | `/images/north-alabama-generic.jpg` | Hazel Green Main Street or signature landmark |
| `city-priceville-hero` | city | `/images/north-alabama-generic.jpg` | Priceville school or lake-area homes |
| `city-somerville-hero` | city | `/images/north-alabama-generic.jpg` | Somerville historic district |
| `og-blog-default` | og | `/og-image.png` | Blog-flavored OG (clipboard / tips framing) |
| `og-city-default` | og | `/og-image.png` | Map of service area or aerial |
| `og-service-default` | og | `/og-image.png` | Crew at work framing |
