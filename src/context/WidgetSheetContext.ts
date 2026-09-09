import { createContext } from 'react';
import type { QuickRecordController } from '../lib/quick-record';

export const WidgetSheetContext = createContext<QuickRecordController | null>(null);
