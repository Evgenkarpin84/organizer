import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { SplashScreen } from './components/states'
import { DataProvider } from './data/DataProvider'
import { MailProvider } from './data/MailProvider'
import { HabitsProvider } from './data/HabitsProvider'
import { NewsProvider } from './data/NewsProvider'
import { useSession } from './data/useSession'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthScreen } from './screens/AuthScreen'
import { MailMessageScreen } from './screens/MailMessageScreen'
import { MailScreen } from './screens/MailScreen'
import { ChecklistScreen } from './screens/ChecklistScreen'
import { HabitEditorScreen } from './screens/HabitEditorScreen'
import { HabitsScreen } from './screens/HabitsScreen'
import { NewsScreen } from './screens/NewsScreen'
import { NotificationsScreen } from './screens/NotificationsScreen'
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
          <HabitsProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<TodayScreen />} />
            <Route path="/tasks" element={<TasksScreen />} />
            <Route path="/settings" element={<NotificationsScreen />} />
            <Route path="/mail" element={<MailScreen />} />
            <Route path="/news" element={<NewsScreen />} />
            <Route path="/habits" element={<HabitsScreen />} />
          </Route>
          <Route path="/mail/:id" element={<MailMessageScreen />} />
          <Route path="/habit/new" element={<HabitEditorScreen />} />
          <Route path="/habit/:id" element={<HabitEditorScreen />} />
          <Route path="/checklist/new" element={<ChecklistScreen />} />
          <Route path="/checklist/:id" element={<ChecklistScreen />} />
          <Route path="/task/new" element={<TaskEditorScreen />} />
          <Route path="/task/:id" element={<TaskEditorScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
          </HabitsProvider>
        </NewsProvider>
      </MailProvider>
    </DataProvider>
  )
}
