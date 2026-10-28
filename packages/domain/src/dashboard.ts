import {z} from 'zod';
export const widgetNames=['campaigns','delivery','budget','activity'] as const;
export const dashboardSchema=z.object({widgets:z.array(z.enum(widgetNames)).max(4).refine(list=>new Set(list).size===list.length,'Widgets must be unique'),
  sizes:z.partialRecord(z.enum(widgetNames),z.enum(['half','full'])).default({}),
  filters:z.object({channel:z.enum(['all','email','sms','whatsapp']).default('all'),days:z.enum(['all','1','7','30','90']).default('all')}).default({channel:'all',days:'all'})});
export type DashboardLayout=z.infer<typeof dashboardSchema>;
export const defaultDashboard:DashboardLayout={widgets:[...widgetNames],sizes:{campaigns:'full',activity:'full',delivery:'half',budget:'half'},filters:{channel:'all',days:'all'}};
