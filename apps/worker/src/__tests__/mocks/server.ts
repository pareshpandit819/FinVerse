import { setupServer } from "msw/node";
import { plaidHandlers } from "./plaid-handlers.js";

export const server = setupServer(...plaidHandlers);
