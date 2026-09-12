import { getAllModels } from "./modelCatalog.js";
import { filterEligibleModels } from "./modelEligibility.js";
import { rankModels } from "./modelRanking.js";

export function selectModels(requirements = {}) {
    const allModels = getAllModels();

    const eligibleModels = filterEligibleModels(
        allModels,
        requirements
    );

    return rankModels(
        eligibleModels,
        requirements
    );
}