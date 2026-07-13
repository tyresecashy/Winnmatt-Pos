'use server'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

const BUCKET_NAME = 'po-documents'

export interface POAttachment {
  id: string
  purchase_order_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  uploaded_by: string | null
  created_at: string
}

/**
 * Ensure the po-documents storage bucket exists.
 * Called lazily before first upload.
 */
async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET_NAME)) {
    await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10 MB
    })
  }
}

export async function getPOAttachments(purchaseOrderId: string): Promise<POAttachment[]> {
  try {
    await authenticateServerAction()
    const { data, error } = await supabaseAdmin
      .from('po_attachments')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as POAttachment[]
  } catch (error) {
    logger.error('Error fetching PO attachments:', error)
    return []
  }
}

export async function uploadPOAttachment(
  purchaseOrderId: string,
  fileName: string,
  mimeType: string,
  base64Content: string,
): Promise<{ success: boolean; error?: string; attachment?: POAttachment }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    await ensureBucket()

    // Decode base64 → buffer
    const rawData = base64Content.replace(/^data:.*?;base64,/, '')
    const buffer = Buffer.from(rawData, 'base64')

    // Storage path: po-id/timestamp-filename
    const timestamp = Date.now()
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${purchaseOrderId}/${timestamp}-${safeName}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Save metadata in DB
    const { data: attachment, error: dbError } = await supabaseAdmin
      .from('po_attachments')
      .insert({
        purchase_order_id: purchaseOrderId,
        file_name: fileName,
        file_size: buffer.length,
        mime_type: mimeType,
        storage_path: storagePath,
        uploaded_by: profile.id,
      })
      .select()
      .single()

    if (dbError) {
      // Clean up storage on DB failure
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath])
      throw dbError
    }

    return { success: true, attachment: attachment as POAttachment }
  } catch (error) {
    logger.error('Error uploading PO attachment:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deletePOAttachment(attachmentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await authenticateServerAction()

    const { data: attachment, error: fetchError } = await supabaseAdmin
      .from('po_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .single()

    if (fetchError || !attachment) return { success: false, error: 'Attachment not found' }

    // Delete from storage
    await supabaseAdmin.storage.from(BUCKET_NAME).remove([attachment.storage_path])

    // Delete DB record
    const { error: deleteError } = await supabaseAdmin
      .from('po_attachments')
      .delete()
      .eq('id', attachmentId)

    if (deleteError) throw deleteError

    return { success: true }
  } catch (error) {
    logger.error('Error deleting PO attachment:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getAttachmentDownloadUrl(attachmentId: string): Promise<string | null> {
  try {
    await authenticateServerAction()

    const { data: attachment, error } = await supabaseAdmin
      .from('po_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .single()

    if (error || !attachment) return null

    const { data } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(attachment.storage_path, 300) // 5 min expiry

    return data?.signedUrl || null
  } catch (error) {
    logger.error('Error generating download URL:', error)
    return null
  }
}
