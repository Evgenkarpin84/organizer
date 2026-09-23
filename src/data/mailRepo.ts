import { requireSupabase } from '../lib/supabase'
import type { MailAccount, MailMessage } from '../lib/types'

interface AccountRow {
  id: string
  key: string
  label: string
  email: string
  provider: 'mailru' | 'yandex'
  last_sync_at: string | null
  last_error: string | null
}

interface MessageRow {
  id: string
  account_id: string
  subject: string | null
  from_name: string | null
  from_email: string | null
  sent_at: string | null
  received_at: string
  preview: string | null
  body_text: string | null
  body_truncated: boolean
  has_attachments: boolean
  attachment_names: string[] | null
  is_bulk: boolean
  read_at: string | null
  archived_at: string | null
}

const MESSAGE_COLUMNS =
  'id, account_id, subject, from_name, from_email, sent_at, received_at, preview, body_text, body_truncated, has_attachments, attachment_names, is_bulk, read_at, archived_at'

/** Список показывает последние неархивные письма, архив грузится отдельным окном. */
export const INBOX_LIMIT = 200
export const ARCHIVE_LIMIT = 100

function accountFromRow(row: AccountRow): MailAccount {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    email: row.email,
    provider: row.provider,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
  }
}

function messageFromRow(row: MessageRow): MailMessage {
  return {
    id: row.id,
    accountId: row.account_id,
    subject: row.subject,
    fromName: row.from_name,
    fromEmail: row.from_email,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
    preview: row.preview,
    bodyText: row.body_text,
    bodyTruncated: row.body_truncated,
    hasAttachments: row.has_attachments,
    attachmentNames: row.attachment_names ?? [],
    isBulk: row.is_bulk,
    readAt: row.read_at,
    archivedAt: row.archived_at,
  }
}

export async function fetchMailAccounts(): Promise<MailAccount[]> {
  const { data, error } = await requireSupabase()
    .from('mail_accounts')
    .select('id, key, label, email, provider, last_sync_at, last_error')
    .order('key', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as AccountRow[]).map(accountFromRow)
}

export async function fetchMailInbox(limit: number = INBOX_LIMIT): Promise<MailMessage[]> {
  const { data, error } = await requireSupabase()
    .from('mail_messages')
    .select(MESSAGE_COLUMNS)
    .is('archived_at', null)
    .order('received_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as MessageRow[]).map(messageFromRow)
}

export async function fetchMailArchive(limit: number = ARCHIVE_LIMIT): Promise<MailMessage[]> {
  const { data, error } = await requireSupabase()
    .from('mail_messages')
    .select(MESSAGE_COLUMNS)
    .not('archived_at', 'is', null)
    .order('received_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as MessageRow[]).map(messageFromRow)
}

/** Письмо по прямой ссылке, когда его нет в загруженном списке. */
export async function fetchMailMessage(id: string): Promise<MailMessage | null> {
  const { data, error } = await requireSupabase()
    .from('mail_messages')
    .select(MESSAGE_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? messageFromRow(data as MessageRow) : null
}

export async function setMessageRead(id: string, readAt: string | null): Promise<void> {
  const { error } = await requireSupabase().from('mail_messages').update({ read_at: readAt }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setMessageArchived(id: string, archivedAt: string | null): Promise<void> {
  const { error } = await requireSupabase().from('mail_messages').update({ archived_at: archivedAt }).eq('id', id)
  if (error) throw new Error(error.message)
}
