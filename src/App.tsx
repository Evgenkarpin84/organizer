import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { SplashScreen } from './components/states'
import { DataProvider } from './data/DataProvider'
import { MailProvider } from './data/MailProvider'
import { NewsProvider } from './data/NewsProvider'
import { useSession } from './data/useSession'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthScreen } from './screens/AuthScreen'
import { MailMessageScreen } from './screens/MailMessageScreen'
import { MailScreen } from './screens/MailScreen'
import { NewsScreen } from './screens/NewsScreen'
import { NotificationsScreen } from './screens/NotificationsScreen'
import { StubScreen } from './screens/StubScreen'
import { SupabaseMissingScreen } from './screens/SupabaseMissingScreen'
import { TaskEditorScreen } from './screens/TaskEditorScreen'
import { TasksScreen } from './screens/TasksScreen'
import { TodayScreen } from './screens/TodayScreen'

export default function App() {
  const { session, ready } = useSession()

  if (!isSupabaseConfigured) return <SupabaseMissingScreen />
  if (!ready) return <SplashScreen />
  if (!session) return <AuthScreen />

  return (
    <DataProvider>
      <MailProvider>
        <NewsProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<TodayScreen />} />
            <Route path="/tasks" element={<TasksScreen />} />
            <Route path="/settings" element={<NotificationsScreen />} />
            <Route path="/mail" element={<MailScreen />} />
            <Route path="/news" element={<NewsScreen />} />
            <Route
              path="/habits"
              element={
                <StubScreen
                  title="Привычки"
                  stage={5}
                  icon="habits"
                  description="Трекер привычек и чеклисты появятся на этапе 5."
                />
              }
            />
          </Route>
          <Route path="/mail/:id" element={<MailMessageScreen />} />
          <Route path="/task/new" element={<TaskEditorScreen />} />
          <Route path="/task/:id" element={<TaskEditorScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
        </NewsProvider>
      </MailProvider>
    </DataProvider>
  )
}
