import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../models/Report.js";

dotenv.config();

const now = Date.now();

const reports = [
  ["Bridge deck partially collapsed", "Flood water damaged the bridge deck and narrowed safe access for pedestrians and motorcycles.", "flood", "transport", "partial", "Kinshasa", "Gombe", -4.3224, 15.307, "verified"],
  ["Health center wall cracked", "Visible structural cracks were reported after ground movement near the main consultation room.", "earthquake", "health", "partial", "Nord-Kivu", "Goma", -1.6741, 29.2285, "verified"],
  ["Primary school roof destroyed", "Classrooms are exposed after fire damage. Temporary learning space is needed before reopening.", "fire", "education", "complete", "Kongo-Central", "Matadi", -5.8166, 13.45, "pending"],
  ["Mobile tower power system damaged", "Communication service is unstable after the generator enclosure was damaged during conflict.", "conflict", "communication", "partial", "Ituri", "Bunia", 1.5667, 30.25, "verified"],
  ["Water pump contaminated by debris", "Community members report debris and possible contamination around the main water point.", "flood", "utility", "minimal", "Sud-Kivu", "Bukavu", -2.5083, 28.8608, "verified"],
  ["Market stalls burned", "Several commercial stalls are unusable after a fire. Livelihoods are affected for vendors.", "fire", "commercial", "complete", "Haut-Katanga", "Lubumbashi", -11.6647, 27.4794, "verified"],
  ["Government office windows shattered", "Blast pressure damaged windows and entry access. Interior records need protection from rain.", "explosion", "government", "partial", "Kasai-Central", "Kananga", -5.8962, 22.4166, "pending"],
  ["Residential block unsafe", "Families report major wall separation after flooding weakened the structure.", "flood", "residential", "complete", "Mai-Ndombe", "Inongo", -1.95, 18.2667, "verified"],
  ["Public square access blocked", "Fallen debris blocks a public gathering space used for distribution and community notices.", "other", "public_space", "partial", "Tshopo", "Kisangani", 0.5167, 25.2, "verified"],
  ["Chemical spill near utility site", "Residents report odor and restricted access near a utility compound after a chemical incident.", "chemical_incident", "utility", "minimal", "Lualaba", "Kolwezi", -10.7167, 25.4667, "rejected"]
];

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  for (const [index, item] of reports.entries()) {
    const [title, description, crisisType, infrastructureType, damageLevel, province, commune, lat, lng, status] = item;
    await Report.updateOne(
      { assetId: `seed-${String(index + 1).padStart(3, "0")}` },
      {
        $setOnInsert: {
          title,
          description,
          crisisType,
          infrastructureType,
          category: infrastructureType,
          damageLevel,
          province,
          commune,
          status,
          source: "guest",
          imageUrl: "",
          imageUrls: [],
          assetId: `seed-${String(index + 1).padStart(3, "0")}`,
          language: "en",
          debris: index % 3 === 0 ? "yes" : "unknown",
          locationDescription: `${commune}, ${province}`,
          addressText: `${commune}, ${province}`,
          location: {
            type: "Point",
            coordinates: [lng, lat],
            lat,
            lng,
            address: `${commune}, ${province}`
          },
          modularAnswers: {
            accessBlocked: damageLevel !== "minimal",
            servicesDisrupted: ["utility", "communication", "health"].includes(infrastructureType),
            livelihoodsAffected: ["commercial", "transport"].includes(infrastructureType),
            peopleAtRisk: damageLevel === "complete"
          },
          createdAt: new Date(now - (index + 1) * 1000 * 60 * 35),
          version: 1
        }
      },
      { upsert: true }
    );
  }

  const total = await Report.countDocuments();
  console.log(`Seed complete. Reports in database: ${total}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
