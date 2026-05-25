export { coordinator } from './coordinator';
export type { ConversationContext, WorkflowResult } from './coordinator';
export { researchCustomer, researchMarket } from './research';
export type { ResearchResult } from './research';
export { analyzeCustomer, analyzeOpportunity } from './analysis';
export type { AnalysisResult } from './analysis';
export { writeCustomerReport, writeOpportunityDocs } from './writer';
export type { WriteResult } from './writer';
export { upsertCustomer, createOpportunity, updateOpportunity, createActivity, createContact } from './crm';
