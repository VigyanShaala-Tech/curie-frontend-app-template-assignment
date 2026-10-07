import 'core-js/stable';
import 'regenerator-runtime/runtime';

import React, { useEffect, useState } from 'react';
import {
  APP_INIT_ERROR, APP_READY, subscribe, initialize,
} from '@edx/frontend-platform';
import { AppProvider, ErrorPage } from '@edx/frontend-platform/react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Routes, Route, Navigate, useLocation,
} from 'react-router-dom';

import Header from '@edx/frontend-component-header';
import { FooterSlot } from '@edx/frontend-component-footer';

import messages from './i18n';
import { StudentPage } from './tas/components/StudentPage';
import { SubmissionHistoryPage } from './tas/components/SubmissionHistoryPage';
import { HistoricalReviewPage } from './tas/components/HistoricalReviewPage';
import { InstructorPage } from './tas/components/InstructorPage';
import { AdminPage } from './tas/components/AdminPage';
import { isStudentSubmissionRoute } from './tas/utils/studentSubmissionRoutes';

import './index.scss';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

const MOBILE_BREAKPOINT = 768;

/**
 * MFE chrome shell: hide LMS Header/Footer on every mobile student submission route.
 */
const AppShell: React.FC = () => {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false),
  );

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  const isStudentSubmission = isStudentSubmissionRoute(location.pathname);
  const hideChrome = isStudentSubmission && isMobile;

  return (
    <>
      {!hideChrome && <Header />}
      <main
        style={{
          minHeight: hideChrome ? '100vh' : 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Routes>
          <Route path="/submission/:usageKey/history/:version" element={<HistoricalReviewPage />} />
          <Route path="/submission/:usageKey/history" element={<SubmissionHistoryPage />} />
          <Route path="/submission/:usageKey" element={<StudentPage />} />

          {/* Instructor grading view */}
          <Route path="/instructor/grade-submissions/:usageKey" element={<InstructorPage />} />

          {/* Admin — template/type management (staff only) */}
          <Route path="/admin/templates" element={<AdminPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideChrome && <FooterSlot />}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);

subscribe(APP_READY, () => {
  root.render(
    // AppProvider already includes BrowserRouter internally
    <AppProvider>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </AppProvider>,
  );
});

subscribe(APP_INIT_ERROR, (error: { message: any }) => {
  root.render(<ErrorPage message={error.message} />);
});

initialize({ messages });
