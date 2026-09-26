import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query';
import { AuthProvider } from '@/providers/auth';
import { ThemeProvider, useTheme } from '@/providers/theme';
import { WarehouseProvider } from '@/providers/warehouse';
import App from './App';
import './index.css';

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-right" richColors closeButton />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <WarehouseProvider>
              {/* Respect the OS "reduce motion" setting for every animation. */}
              <MotionConfig reducedMotion="user">
                <TooltipProvider delayDuration={300}>
                  <App />
                </TooltipProvider>
              </MotionConfig>
            </WarehouseProvider>
          </AuthProvider>
        </BrowserRouter>
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
