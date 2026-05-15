import { F, C } from "../lib/tokens";
import TopBar from "../components/TopBar";
import { loadCards, loadLootPool } from "../lib/cards";
import CollectionGrid from "./CollectionGrid";

export default function CollectionPage() {
  const cards = loadCards();
  const lootPoolCountries = loadLootPool();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: F.body, color: C.ink }}>
      <TopBar />
      <CollectionGrid cards={cards} lootPoolCountries={lootPoolCountries} />
    </div>
  );
}
