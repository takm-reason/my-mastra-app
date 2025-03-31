import { Workflow } from '@mastra/core/workflows';
import { githubWorkflowInputSchema, githubWorkflowOutputSchema } from './schemas';
import { cloneRepositoryStep, analyzeCodeStep, generateReportStep } from './steps';
import { analyzeRepoInstructions } from './instructions';

export const githubWorkflow = new Workflow({
    name: 'github-workflow',
    triggerSchema: githubWorkflowInputSchema,
})
    .step(cloneRepositoryStep)
    .then(analyzeCodeStep)
    .then(generateReportStep);

githubWorkflow.commit();