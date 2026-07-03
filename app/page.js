import {
  getChannels,
  getMeta,
  getCategories,
  normalizeCategory,
} from "@/lib/channels";
import { ChannelGrid } from "./components/ChannelGrid"; 

export const dynamic = "force-dynamic";

export default function HomePage() {
  const channels = getChannels();
  const meta = getMeta();
  const categories = getCategories();

  // Minimal serializable shape for the client: id, name, logo + normalized category.
  const items = channels.map((c, i) => ({
    id: i,
    name: c.name,
    logo: c.logo,
    category: normalizeCategory(c.category_name),
  }));

  return <ChannelGrid items={items} categories={categories} meta={meta} />;
}
