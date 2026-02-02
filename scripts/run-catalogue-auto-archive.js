require("dotenv").config();

const {
  processCatalogueAutoArchiveOnce,
} = require("../services/catalogue-auto-archive.service");
const { logger } = require("../config/logger");

async function main() {
  try {
    const result = await processCatalogueAutoArchiveOnce();
    // Logger + sortie console pour usage manuel
    console.log("Catalogue auto-archive OK:", result);
    process.exitCode = 0;
  } catch (error) {
    logger.error("Manual catalogue auto-archive failed", {
      error: error?.message,
    });
    console.error("Catalogue auto-archive FAILED:", error?.message || error);
    process.exitCode = 1;
  }
}

main();
