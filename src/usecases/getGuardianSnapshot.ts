import type { PortfolioRepository, PortfolioSnapshot } from "../domain/portfolio/types";

export const getGuardianSnapshot = (repository: PortfolioRepository): Promise<PortfolioSnapshot> => {
  return repository.getSnapshot();
};
